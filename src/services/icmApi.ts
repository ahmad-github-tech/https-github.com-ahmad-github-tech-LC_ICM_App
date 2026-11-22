import type {
  CreateCasePayload,
  DocumentVerificationStatus,
  IcmInBasket,
  IcmWorkItem,
  IntakeConfigResponse,
} from '../types/icm';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/icm';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const icmApi = {
  getIntakeConfig(): Promise<IntakeConfigResponse> {
    return requestJson<IntakeConfigResponse>(`${API_BASE}/intake-config`);
  },

  createCase(payload: CreateCasePayload): Promise<IcmWorkItem> {
    return requestJson<IcmWorkItem>(`${API_BASE}/cases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getInBaskets(): Promise<IcmInBasket[]> {
    return requestJson<IcmInBasket[]>(`${API_BASE}/inbaskets`);
  },

  getWorkItems(inBasketId?: string): Promise<IcmWorkItem[]> {
    const query = inBasketId ? `?inBasketId=${encodeURIComponent(inBasketId)}` : '';
    return requestJson<IcmWorkItem[]>(`${API_BASE}/workitems${query}`);
  },

  getWorkItem(wobNum: string): Promise<IcmWorkItem> {
    return requestJson<IcmWorkItem>(`${API_BASE}/workitems/${encodeURIComponent(wobNum)}`);
  },

  getCaseById(caseId: string): Promise<IcmWorkItem> {
    return requestJson<IcmWorkItem>(`${API_BASE}/cases/${encodeURIComponent(caseId)}`);
  },

  saveFields(
    wobNum: string,
    fieldValues: Record<string, string>,
    actor: string
  ): Promise<IcmWorkItem> {
    return requestJson<IcmWorkItem>(`${API_BASE}/workitems/${encodeURIComponent(wobNum)}/save`, {
      method: 'POST',
      body: JSON.stringify({ fieldValues, actor }),
    });
  },

  completeStep(
    wobNum: string,
    payload: {
      outcome: string;
      reason: string;
      fieldValues: Record<string, string>;
      actor: string;
    }
  ): Promise<{ completedWobNum: string; nextWorkItem: IcmWorkItem | null; updatedItem: IcmWorkItem }> {
    return requestJson(`${API_BASE}/workitems/${encodeURIComponent(wobNum)}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  reassignWorkItem(wobNum: string, targetUser: string, actor: string): Promise<IcmWorkItem> {
    return requestJson<IcmWorkItem>(`${API_BASE}/workitems/${encodeURIComponent(wobNum)}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ targetUser, actor }),
    });
  },

  updateDocumentStatus(
    caseId: string,
    docId: string,
    verificationStatus: DocumentVerificationStatus,
    discrepancyNote: string,
    actor: string
  ): Promise<IcmWorkItem> {
    return requestJson<IcmWorkItem>(
      `${API_BASE}/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(docId)}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ verificationStatus, discrepancyNote, actor }),
      }
    );
  },

  addComment(caseId: string, message: string, actor: string, role: string): Promise<IcmWorkItem> {
    return requestJson<IcmWorkItem>(`${API_BASE}/cases/${encodeURIComponent(caseId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message, actor, role }),
    });
  },
};
