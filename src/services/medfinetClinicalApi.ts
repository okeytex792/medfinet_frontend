import {
  medfinetDownload as download,
  medfinetRequest as request,
} from './medfinetApiClient';

export type VaccinationCertificateEvidence = {
  recordId: string;
  fingerprint: string;
  anchorId: string;
  status: 'DISABLED' | 'PENDING' | 'CONFIRMED' | 'UNCONFIRMED' | 'MISMATCH' | 'UNAVAILABLE';
  queued: boolean;
  network: string | null;
  txId: string | null;
  blockHeight: string | null;
  confirmedAt: string | null;
  explorerUrl: string | null;
  hashIntegrity: boolean | null;
  noteIntegrity: boolean | null;
  chainConfirmed: boolean | null;
};

export const medfinetClinicalApi = {
  // Timeline
  getClinicalTimeline(orgId: string, childId: string) {
    return request<{
      immunizations: Array<{ id: string; vaccineCode: string; doseNumber: number; administeredAt: string; status: string }>;
      growth: Array<{ id: string; measuredAt: string; weightGrams?: number; heightMillimeters?: number; muacMillimeters?: number; vitaminAAdministered: boolean; oedemaPresent: boolean; notes?: string; status: string }>;
      alerts: Array<{ id: string; category: string; severity: string; summary: string; status: string }>;
      allergies: Array<{ id: string; substanceDisplay: string; reaction?: string; severity: string; criticality: string; status: string }>;
      appointments: Array<{ id: string; kind: string; scheduledFor: string; status: string; notes?: string }>;
    }>(`/children/${encodeURIComponent(childId)}/clinical-timeline`, {
      organizationId: orgId, purpose: 'clinical-record-view',
    });
  },

  // Immunizations
  recordImmunization(orgId: string, childId: string, body: {
    vaccineCode: string; doseNumber: number; administeredAt: string;
    lotNumber?: string; route?: string; site?: string; notes?: string; sourceOperationId?: string;
  }) {
    return request<{ id: string }>(`/children/${encodeURIComponent(childId)}/immunizations`, {
      method: 'POST', body, organizationId: orgId, purpose: 'immunization-recording',
    });
  },
  amendImmunization(orgId: string, immunizationId: string, body: {
    administeredAt?: string; lotNumber?: string; notes?: string; reason: string;
  }) {
    return request(`/immunizations/${encodeURIComponent(immunizationId)}`, {
      method: 'PATCH', body, organizationId: orgId, purpose: 'immunization-amendment',
    });
  },
  downloadImmunizationCertificate(orgId: string, childId: string, immunizationId: string) {
    return download(
      `/children/${encodeURIComponent(childId)}/immunizations/${encodeURIComponent(immunizationId)}/certificate`,
      {
        organizationId: orgId,
        purpose: 'vaccination-certificate-download',
      },
    );
  },
  getImmunizationCertificateEvidence(orgId: string, childId: string, immunizationId: string) {
    return request<VaccinationCertificateEvidence>(
      `/children/${encodeURIComponent(childId)}/immunizations/${encodeURIComponent(immunizationId)}/certificate/evidence`,
      {
        organizationId: orgId,
        purpose: 'vaccination-certificate-download',
      },
    );
  },

  // Growth Measurements
  recordGrowth(orgId: string, childId: string, body: {
    measuredAt: string; weightGrams?: number; heightMillimeters?: number;
    muacMillimeters?: number; vitaminAAdministered?: boolean; oedemaPresent?: boolean; notes?: string; facilityId?: string; sourceOperationId?: string;
  }) {
    return request<{ id: string }>(`/children/${encodeURIComponent(childId)}/growth-measurements`, {
      method: 'POST', body, organizationId: orgId, purpose: 'growth-recording',
    });
  },
  amendGrowth(orgId: string, growthId: string, body: {
    weightGrams?: number; heightMillimeters?: number; reason: string;
  }) {
    return request(`/growth-measurements/${encodeURIComponent(growthId)}`, {
      method: 'PATCH', body, organizationId: orgId, purpose: 'growth-amendment',
    });
  },

  // Clinical Alerts
  createAlert(orgId: string, childId: string, body: {
    category: string; severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    summary: string; detail?: string; emergencyVisible?: boolean;
  }) {
    return request<{ id: string }>(`/children/${encodeURIComponent(childId)}/clinical-alerts`, {
      method: 'POST', body, organizationId: orgId, purpose: 'alert-creation',
    });
  },
  resolveAlert(orgId: string, alertId: string, body: { status: 'RESOLVED' | 'ENTERED_IN_ERROR'; reason: string }) {
    return request(`/clinical-alerts/${encodeURIComponent(alertId)}/status`, {
      method: 'PATCH', body, organizationId: orgId, purpose: 'alert-resolution',
    });
  },

  // Allergies
  recordAllergy(orgId: string, childId: string, body: {
    substanceDisplay: string; reaction?: string; severity: string; criticality: string;
  }) {
    return request<{ id: string }>(`/children/${encodeURIComponent(childId)}/allergies`, {
      method: 'POST', body, organizationId: orgId, purpose: 'allergy-recording',
    });
  },
  resolveAllergy(orgId: string, allergyId: string, body: { status: 'RESOLVED' | 'ENTERED_IN_ERROR'; resolutionReason: string }) {
    return request(`/allergies/${encodeURIComponent(allergyId)}/status`, {
      method: 'PATCH', body, organizationId: orgId, purpose: 'allergy-resolution',
    });
  },

  // Appointments
  scheduleAppointment(orgId: string, childId: string, body: {
    kind: string; scheduledFor: string; facilityId?: string; notes?: string;
  }) {
    return request<{ id: string }>(`/children/${encodeURIComponent(childId)}/appointments`, {
      method: 'POST', body, organizationId: orgId, purpose: 'appointment-scheduling',
    });
  },
  updateAppointmentStatus(orgId: string, appointmentId: string, body: {
    status: 'COMPLETED' | 'CANCELLED' | 'MISSED'; notes?: string;
  }) {
    return request(`/appointments/${encodeURIComponent(appointmentId)}/status`, {
      method: 'PATCH', body, organizationId: orgId, purpose: 'appointment-status-update',
    });
  },

  // Emergency Access
  activateEmergencyAccess(orgId: string, childId: string, body: {
    reasonCode: string; justification: string; durationMinutes: number;
  }) {
    return request<{ id: string; expiresAt: string }>(
      `/children/${encodeURIComponent(childId)}/emergency-access`,
      { method: 'POST', body, organizationId: orgId, purpose: 'emergency-care-activation' }
    );
  },
  getEmergencyProfile(orgId: string, childId: string, accessId: string) {
    return request<{
      access: { id: string; expiresAt: string };
      profile: {
        id: string; medfinetId: string; firstName: string; lastName: string;
        allergies: Array<{ substanceDisplay: string; reaction?: string; severity: string }>;
        clinicalAlerts: Array<{ category: string; severity: string; summary: string }>;
        immunizations: Array<{ vaccineCode: string; doseNumber: number; administeredAt: string }>;
      };
    }>(`/children/${encodeURIComponent(childId)}/emergency-profile`, {
      organizationId: orgId, purpose: 'emergency-care-view',
      headers: { 'x-emergency-access-id': accessId },
    });
  },
  reviewEmergencyAccess(orgId: string, accessId: string, body: {
    decision: 'APPROVED' | 'FLAGGED'; reviewNotes: string;
  }) {
    return request(`/emergency-access/${encodeURIComponent(accessId)}/review`, {
      method: 'POST', body, organizationId: orgId, purpose: 'emergency-access-review',
    });
  },

  // Vaccine Schedule
  listScheduleRules(orgId: string) {
    return request<Array<{
      id: string; vaccineCode: string; doseNumber: number;
      minimumAgeDays: number; recommendedAgeDays: number; maximumAgeDays: number | null;
      minimumIntervalDays?: number | null; status: string; version: number; createdBySubjectId: string;
    }>>('/vaccine-schedule-rules', {
      organizationId: orgId, purpose: 'schedule-view',
    });
  },
  createScheduleRule(orgId: string, body: {
    vaccineCode: string; doseNumber: number; recommendedAgeDays: number;
    minimumAgeDays: number; maximumAgeDays?: number | null; minimumIntervalDays?: number | null; programmeId?: string;
  }) {
    return request('/vaccine-schedule-rules', {
      method: 'POST', body, organizationId: orgId, purpose: 'schedule-management',
    });
  },
  activateScheduleRule(orgId: string, ruleId: string) {
    return request(`/vaccine-schedule-rules/${encodeURIComponent(ruleId)}/activate`, { method: 'POST', organizationId: orgId, purpose: 'schedule-management' });
  },
  evaluateSchedule(orgId: string, childId: string) {
    return request<{
      childId: string; programmeId: string | null; asOf: string;
      recommendations: Array<{ vaccineCode: string; doseNumber: number; dueAt: string; eligibleAt?: string; completedAt?: string | null; status: string; ruleId: string; ruleVersion: number }>;
    }>(`/children/${encodeURIComponent(childId)}/vaccine-schedule`, {
      organizationId: orgId, purpose: 'schedule-evaluation',
    });
  },
};
