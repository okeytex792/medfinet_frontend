import { FormEvent, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Blocks, CheckCircle2, Download, ExternalLink, Loader2, RefreshCw, ShieldAlert, Syringe, X } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { medfinetClinicalApi, type VaccinationCertificateEvidence } from '../../services/medfinetClinicalApi';
import UserContext from '../../contexts/UserContext';

type Timeline = Awaited<ReturnType<typeof medfinetClinicalApi.getClinicalTimeline>>;
type EmergencyProfile = Awaited<ReturnType<typeof medfinetClinicalApi.getEmergencyProfile>>;

function WorkflowShell({ title, children }: { title: string; children: React.ReactNode }) {
  const location = useLocation();
  const scannerPath = location.pathname.startsWith('/nfc/') ? '/nfc/scanner' : '/health-worker/nfc';
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link to={scannerPath} className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800"><ArrowLeft size={17} /> Back to scanner</Link>
        <h1 className="mt-5 text-3xl font-bold">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function NfcClinicalRecordPage() {
  const { organizationId } = useContext(UserContext);
  const { childId = '' } = useParams();
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [error, setError] = useState('');
  const [certificateDownloadId, setCertificateDownloadId] = useState<string | null>(null);
  const [certificateError, setCertificateError] = useState('');
  const [certificatePreview, setCertificatePreview] = useState<{
    url: string;
    filename: string;
    label: string;
    immunizationId: string;
    evidence: VaccinationCertificateEvidence;
  } | null>(null);
  const certificatePreviewUrl = useRef<string | null>(null);
  const certificatePageMounted = useRef(true);
  const [certificateEvidenceBusy, setCertificateEvidenceBusy] = useState(false);
  useEffect(() => {
    if (!organizationId) return;
    medfinetClinicalApi.getClinicalTimeline(organizationId, childId)
      .then(setTimeline)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load clinical record'));
  }, [childId, organizationId]);

  useEffect(() => {
    certificatePageMounted.current = true;
    return () => {
      certificatePageMounted.current = false;
      if (certificatePreviewUrl.current) URL.revokeObjectURL(certificatePreviewUrl.current);
    };
  }, []);

  function closeCertificatePreview() {
    if (certificatePreviewUrl.current) URL.revokeObjectURL(certificatePreviewUrl.current);
    certificatePreviewUrl.current = null;
    setCertificatePreview(null);
  }

  async function viewCertificate(immunization: Timeline['immunizations'][number]) {
    if (!organizationId) return;
    setCertificateDownloadId(immunization.id);
    setCertificateError('');
    try {
      const [{ blob, filename }, evidence] = await Promise.all([
        medfinetClinicalApi.downloadImmunizationCertificate(
          organizationId,
          childId,
          immunization.id,
        ),
        medfinetClinicalApi.getImmunizationCertificateEvidence(
          organizationId,
          childId,
          immunization.id,
        ),
      ]);
      const url = URL.createObjectURL(blob);
      if (!certificatePageMounted.current) {
        URL.revokeObjectURL(url);
        return;
      }
      closeCertificatePreview();
      certificatePreviewUrl.current = url;
      setCertificatePreview({
        url,
        filename: filename || 'vaccination-certificate.png',
        label: `${immunization.vaccineCode} dose ${immunization.doseNumber}`,
        immunizationId: immunization.id,
        evidence,
      });
    } catch (caught) {
      if (certificatePageMounted.current) {
        setCertificateError(
          caught instanceof Error
            ? caught.message
            : 'Could not load the vaccination certificate',
        );
      }
    } finally {
      if (certificatePageMounted.current) setCertificateDownloadId(null);
    }
  }

  async function refreshCertificateEvidence() {
    if (!organizationId || !certificatePreview) return;
    setCertificateEvidenceBusy(true);
    setCertificateError('');
    try {
      const evidence = await medfinetClinicalApi.getImmunizationCertificateEvidence(
        organizationId,
        childId,
        certificatePreview.immunizationId,
      );
      if (certificatePageMounted.current) {
        setCertificatePreview((current) => current ? { ...current, evidence } : current);
      }
    } catch (caught) {
      if (certificatePageMounted.current) {
        setCertificateError(
          caught instanceof Error
            ? caught.message
            : 'Could not refresh Algorand verification',
        );
      }
    } finally {
      if (certificatePageMounted.current) setCertificateEvidenceBusy(false);
    }
  }

  return (
    <WorkflowShell title="Vaccinations and certificates">
      {error && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900">{error}</p>}
      {certificateError && <p role="alert" className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900">{certificateError}</p>}
      {!timeline && !error && <Loader2 className="animate-spin text-cyan-700" />}
      {timeline && (
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">Immunizations</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {timeline.immunizations.map((item) => (
                <div key={item.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-slate-900">{item.vaccineCode} · Dose {item.doseNumber}</span>
                    <time className="shrink-0 text-slate-500">{new Date(item.administeredAt).toLocaleDateString()}</time>
                  </div>
                  <button
                    type="button"
                    onClick={() => void viewCertificate(item)}
                    disabled={certificateDownloadId !== null}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {certificateDownloadId === item.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Download className="h-4 w-4" />}
                    {certificateDownloadId === item.id ? 'Loading certificate…' : 'View certificate'}
                  </button>
                </div>
              ))}
              {!timeline.immunizations.length && (
                <div className="py-4 text-sm text-slate-500">
                  <p className="font-semibold text-slate-700">No immunizations recorded.</p>
                  <p className="mt-1">A certificate becomes available after a vaccination dose is recorded.</p>
                </div>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">Allergies and alerts</h2>
            <div className="mt-3 space-y-3">
              {timeline.allergies.filter(({ status }) => status === 'ACTIVE').map((item) => <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{item.substanceDisplay}</strong>{item.reaction && <p>{item.reaction}</p>}</div>)}
              {timeline.alerts.filter(({ status }) => status === 'ACTIVE').map((item) => <div key={item.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm"><strong>{item.category}</strong><p>{item.summary}</p></div>)}
              {!timeline.allergies.length && !timeline.alerts.length && <p className="text-sm text-slate-500">No active allergies or alerts.</p>}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-2">
            <h2 className="text-lg font-bold">Growth and appointments</h2>
            <p className="mt-2 text-sm text-slate-600">{timeline.growth.length} growth measurements · {timeline.appointments.length} appointments</p>
          </section>
          {certificatePreview && (
            <section className="rounded-2xl border border-emerald-200 bg-white p-4 md:col-span-2 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Vaccination certificate</h2>
                  <p className="mt-1 text-sm text-slate-600">{certificatePreview.label}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close certificate preview"
                  onClick={closeCertificatePreview}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <img
                src={certificatePreview.url}
                alt={`Vaccination certificate for ${certificatePreview.label}`}
                className="mx-auto mt-4 max-h-[70vh] w-auto rounded-xl border border-slate-200 shadow-sm"
              />
              <div className={`mt-4 rounded-xl border p-4 ${
                certificatePreview.evidence.status === 'CONFIRMED'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                  : certificatePreview.evidence.status === 'MISMATCH'
                    ? 'border-rose-300 bg-rose-50 text-rose-950'
                    : 'border-amber-300 bg-amber-50 text-amber-950'
              }`}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="flex items-center gap-2 font-bold">
                      {certificatePreview.evidence.status === 'CONFIRMED'
                        ? <CheckCircle2 className="h-5 w-5" />
                        : <Blocks className="h-5 w-5" />}
                      {certificatePreview.evidence.status === 'CONFIRMED'
                        ? `Verified on ${certificatePreview.evidence.network || 'Algorand'}`
                        : certificatePreview.evidence.status === 'PENDING'
                          ? 'Algorand verification pending'
                          : certificatePreview.evidence.status === 'DISABLED'
                            ? 'Algorand verification is not configured'
                            : certificatePreview.evidence.status === 'MISMATCH'
                              ? 'Algorand proof mismatch'
                              : 'Algorand verification is temporarily unavailable'}
                    </p>
                    <p className="mt-1 text-xs leading-5 opacity-80">
                      Only a cryptographic fingerprint is anchored. No child identity or medical details are written to Algorand.
                    </p>
                    {certificatePreview.evidence.txId && (
                      <p className="mt-2 break-all font-mono text-xs">
                        Transaction: {certificatePreview.evidence.txId}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {certificatePreview.evidence.explorerUrl && (
                      <a
                        href={certificatePreview.evidence.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-current/20 bg-white/70 px-3 py-2 text-sm font-bold"
                      >
                        View on explorer <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {certificatePreview.evidence.status !== 'DISABLED' && (
                      <button
                        type="button"
                        onClick={() => void refreshCertificateEvidence()}
                        disabled={certificateEvidenceBusy}
                        className="inline-flex items-center gap-2 rounded-lg border border-current/20 bg-white/70 px-3 py-2 text-sm font-bold disabled:opacity-60"
                      >
                        <RefreshCw className={`h-4 w-4 ${certificateEvidenceBusy ? 'animate-spin' : ''}`} />
                        Refresh proof
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <a
                href={certificatePreview.url}
                download={certificatePreview.filename}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
              >
                <Download className="h-5 w-5" /> Download PNG
              </a>
            </section>
          )}
        </div>
      )}
    </WorkflowShell>
  );
}

export function NfcVaccinationPage() {
  const { organizationId } = useContext(UserContext);
  const { childId = '' } = useParams();
  const [form, setForm] = useState({ vaccineCode: '', doseNumber: '1', lotNumber: '', route: '', site: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setSaved(false);
    try {
      if (!organizationId) throw new Error('Select an organization first.');
      await medfinetClinicalApi.recordImmunization(organizationId, childId, {
        vaccineCode: form.vaccineCode.trim(),
        doseNumber: Number(form.doseNumber),
        administeredAt: new Date().toISOString(),
        lotNumber: form.lotNumber.trim() || undefined,
        route: form.route.trim() || undefined,
        site: form.site.trim() || undefined,
        notes: form.notes.trim() || undefined,
        sourceOperationId: crypto.randomUUID(),
      });
      setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Vaccination could not be recorded'); }
    finally { setBusy(false); }
  }
  return (
    <WorkflowShell title="Record vaccination">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(form).map(([name, value]) => (
            <label key={name} className={name === 'notes' ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-sm font-semibold capitalize text-slate-700">{name.replace(/([A-Z])/g, ' $1')}</span><input required={name === 'vaccineCode' || name === 'doseNumber'} type={name === 'doseNumber' ? 'number' : 'text'} min={name === 'doseNumber' ? 1 : undefined} value={value} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {saved && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={18} /> Vaccination recorded and audited.</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" /> : <Syringe size={19} />} Save vaccination</button>
      </form>
    </WorkflowShell>
  );
}

export function NfcEmergencyPage() {
  const { organizationId } = useContext(UserContext);
  const { childId = '' } = useParams();
  const [reasonCode, setReasonCode] = useState('IMMEDIATE_CARE');
  const [justification, setJustification] = useState('');
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function activate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (!organizationId) throw new Error('Select an organization first.');
      const access = await medfinetClinicalApi.activateEmergencyAccess(organizationId, childId, { reasonCode, justification, durationMinutes: 15 });
      setProfile(await medfinetClinicalApi.getEmergencyProfile(organizationId, childId, access.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Emergency access failed'); }
    finally { setBusy(false); }
  }
  return (
    <WorkflowShell title="Emergency access">
      {!profile && <form onSubmit={activate} className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5 sm:p-6"><div className="flex gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"><ShieldAlert className="shrink-0" /><p>This action requires recent step-up authentication, is time-limited, notifies the caregiver and is reviewed by administrators.</p></div><label className="block"><span className="mb-1 block text-sm font-semibold">Reason code</span><select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="IMMEDIATE_CARE">Immediate care</option><option value="UNCONSCIOUS_PATIENT">Unconscious patient</option><option value="LIFE_THREATENING">Life threatening</option></select></label><label className="block"><span className="mb-1 block text-sm font-semibold">Clinical justification</span><textarea required minLength={10} value={justification} onChange={(event) => setJustification(event.target.value)} className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-rose-700 px-4 py-3 font-semibold text-white disabled:opacity-50">Activate 15-minute emergency access</button></form>}
      {profile && <section className="space-y-4 rounded-2xl border border-rose-300 bg-white p-5"><div className="flex items-center gap-2 text-rose-700"><AlertTriangle /><strong>Emergency session expires {new Date(profile.access.expiresAt).toLocaleTimeString()}</strong></div><h2 className="text-2xl font-bold">{profile.profile.firstName} {profile.profile.lastName}</h2><div><h3 className="font-bold">Critical allergies</h3>{profile.profile.allergies.map((item) => <p key={item.substanceDisplay} className="mt-2 rounded-xl bg-amber-50 p-3">{item.substanceDisplay}{item.reaction ? ` · ${item.reaction}` : ''}</p>)}</div><div><h3 className="font-bold">Emergency alerts</h3>{profile.profile.clinicalAlerts.map((item) => <p key={`${item.category}-${item.summary}`} className="mt-2 rounded-xl bg-rose-50 p-3">{item.summary}</p>)}</div></section>}
    </WorkflowShell>
  );
}
