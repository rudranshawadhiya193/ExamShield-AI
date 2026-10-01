const QUEUE_KEY = "examshield_offline_response_queue_v1";
const SESSION_KEY_NAME = "examshield_demo_aes_key_v1";

export interface OfflineResponse {
  response_id: string;
  exam_id: string;
  candidate_id: string;
  question_id: string;
  encrypted_response: string;
  response_hash: string;
  answered_at: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  let binary = "";

  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}


async function getEncryptionKey(): Promise<CryptoKey> {
  const savedKey = sessionStorage.getItem(
    SESSION_KEY_NAME
  );

  if (savedKey) {
    const rawKey = base64ToArrayBuffer(savedKey);

    return crypto.subtle.importKey(
      "raw",
      rawKey,
      {
        name: "AES-GCM",
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  const key = await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedKey = await crypto.subtle.exportKey(
    "raw",
    key
  );

  sessionStorage.setItem(
    SESSION_KEY_NAME,
    arrayBufferToBase64(exportedKey)
  );

  return key;
}


async function encryptAnswer(
  answer: string
): Promise<string> {
  const key = await getEncryptionKey();

  const iv = crypto.getRandomValues(
    new Uint8Array(12)
  );

  const encodedAnswer =
    new TextEncoder().encode(answer);

  const encrypted =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      encodedAnswer
    );

  const encryptedBytes =
    new Uint8Array(encrypted);

  const combined =
    new Uint8Array(
      iv.byteLength +
      encryptedBytes.byteLength
    );

  combined.set(iv, 0);

  combined.set(
    encryptedBytes,
    iv.byteLength
  );

  return arrayBufferToBase64(
    combined.buffer
  );
}


async function createHash(
  value: string
): Promise<string> {
  const encodedValue =
    new TextEncoder().encode(value);

  const hashBuffer =
    await crypto.subtle.digest(
      "SHA-256",
      encodedValue
    );

  const hashBytes =
    new Uint8Array(hashBuffer);

  return Array.from(hashBytes)
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}


export async function buildOfflineResponse(
  examId: string,
  candidateId: string,
  questionId: string,
  answer: string
): Promise<OfflineResponse> {
  const encryptedResponse =
    await encryptAnswer(answer);

  const responseHash =
    await createHash(
      encryptedResponse
    );

  return {
    response_id:
      `${candidateId}-${examId}-${questionId}`,

    exam_id: examId,

    candidate_id:
      candidateId,

    question_id:
      questionId,

    encrypted_response:
      encryptedResponse,

    response_hash:
      responseHash,

    answered_at:
      new Date().toISOString(),
  };
}


export function loadResponseQueue():
  OfflineResponse[] {
  const savedQueue =
    localStorage.getItem(
      QUEUE_KEY
    );

  if (!savedQueue) {
    return [];
  }

  try {
    return JSON.parse(
      savedQueue
    ) as OfflineResponse[];
  } catch {
    return [];
  }
}


export function saveResponseQueue(
  queue: OfflineResponse[]
): void {
  localStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(queue)
  );
}


export function upsertQueuedResponse(
  response: OfflineResponse
): OfflineResponse[] {
  const queue =
    loadResponseQueue();

  const existingIndex =
    queue.findIndex(
      (item) =>
        item.response_id ===
        response.response_id
    );

  if (existingIndex >= 0) {
    queue[existingIndex] =
      response;
  } else {
    queue.push(response);
  }

  saveResponseQueue(queue);

  return queue;
}


export function removeQueuedResponse(
  responseId: string
): OfflineResponse[] {
  const queue =
    loadResponseQueue().filter(
      (item) =>
        item.response_id !==
        responseId
    );

  saveResponseQueue(queue);

  return queue;
}


export function clearResponseQueue(): void {
  localStorage.removeItem(
    QUEUE_KEY
  );
}