/**
 * IDENTITY VERIFICATION ENGINE
 * ==================================================================
 * Requirement 16: RFID is PRIMARY, face verification is SECONDARY.
 *
 *   RFID tap -> identify student -> camera processes face
 *            -> compare against registered representation
 *            -> confidence
 *            -> confident ? VERIFIED : TEACHER REVIEW
 *
 * PRIVACY: captured frames are never stored. Only an abstract
 * faceTemplateId reference plus the confidence score is retained.
 * The comparison itself is simulated with a configurable confidence so
 * the prototype is reliable without biometric hardware.
 *
 * Requirement 19: Forgotten Card fallback requires Student ID + backup
 * PIN. An ID alone is never trusted.
 */

import type { SchoolData, Student } from '../types';

/** Confidence at or above this is accepted without human review. */
export const FACE_VERIFY_THRESHOLD = 75;

/** Confidence below this means the camera effectively failed. */
export const FACE_CAMERA_FAILURE_THRESHOLD = 20;

export type IdentityMethod =
  | 'RFID_FACE_VERIFIED'
  | 'RFID_FACE_REVIEW'
  | 'RFID_ONLY'
  | 'MANUAL_ID_PIN'
  | 'FAILED';

export interface IdentityResult {
  method: IdentityMethod;
  student: Student | null;
  confidence: number | null;
  /** true when the record must be sent to the teacher review queue */
  requiresReview: boolean;
  message: string;
}

export interface ScanContext {
  /** what the terminal read from the card */
  cardNumber: string;
  /** value shown in the face-verification panel (0-100) */
  faceConfidence: number;
  cameraFailure: boolean;
  /** typed in for the forgotten-card flow */
  typedId?: string;
  typedPin?: string;
}

/**
 * identifyStudent()
 * ------------------------------------------------------------------
 * Resolves the identity behind a scan.
 *
 * Step 1  Read the card number from the RFID reader.
 * Step 2  If a card was read, look the student up.
 * Step 3  If no card (forgotten card), fall back to ID + backup PIN.
 * Step 4  Run secondary face verification.
 * Step 5  Decide VERIFIED vs REVIEW.
 */
export function identifyStudent(
  data: SchoolData,
  ctx: ScanContext,
): IdentityResult {
  /* --- Step 1 & 2: primary RFID identification ------------------- */
  let student: Student | null = null;
  let method: IdentityMethod = 'RFID_ONLY';

  if (ctx.cardNumber && ctx.cardNumber.trim().length > 0) {
    student =
      data.students.find((s) => s.studentNumber === ctx.cardNumber.trim()) ?? null;
    if (!student) {
      return {
        method: 'FAILED',
        student: null,
        confidence: null,
        requiresReview: false,
        message: 'CARD NOT RECOGNISED — CHECK RFID CARD',
      };
    }
    method = 'RFID_ONLY';
  }

  /* --- Step 3: forgotten card fallback -------------------------- */
  if (!student) {
    const id = (ctx.typedId ?? '').trim();
    const pin = (ctx.typedPin ?? '').trim();
    if (!id) {
      return {
        method: 'FAILED',
        student: null,
        confidence: null,
        requiresReview: false,
        message: 'NO CARD READ — ENTER STUDENT ID AND PIN',
      };
    }
    const byNumber = data.students.find((s) => s.studentNumber === id);
    if (!byNumber || byNumber.backupPin !== pin) {
      return {
        method: 'FAILED',
        student: null,
        confidence: null,
        requiresReview: false,
        message: 'ID / PIN VERIFICATION FAILED',
      };
    }
    student = byNumber;
    method = 'MANUAL_ID_PIN';
  }

  /* --- Step 4: secondary face verification ---------------------- */
  if (ctx.cameraFailure || ctx.faceConfidence < FACE_CAMERA_FAILURE_THRESHOLD) {
    // Camera unusable. A strong RFID read is still enough to proceed, but
    // the record is flagged so the teacher can see the camera was down.
    return {
      method: method === 'MANUAL_ID_PIN' ? 'MANUAL_ID_PIN' : 'RFID_ONLY',
      student,
      confidence: ctx.cameraFailure ? 0 : ctx.faceConfidence,
      requiresReview: method === 'MANUAL_ID_PIN',
      message: 'CAMERA UNAVAILABLE — RFID ONLY, MANUAL VERIFICATION REQUIRED',
    };
  }

  /* --- Step 5: verdict ----------------------------------------- */
  if (ctx.faceConfidence >= FACE_VERIFY_THRESHOLD) {
    return {
      method: 'RFID_FACE_VERIFIED',
      student,
      confidence: ctx.faceConfidence,
      requiresReview: false,
      message: `IDENTITY VERIFIED (${ctx.faceConfidence}%)`,
    };
  }

  return {
    method: 'RFID_FACE_REVIEW',
    student,
    confidence: ctx.faceConfidence,
    requiresReview: true,
    message: `LOW CONFIDENCE (${ctx.faceConfidence}%) — TEACHER REVIEW REQUIRED`,
  };
}

/**
 * verifyIdentity()
 * Thin wrapper kept separate so the flowchart can show a single
 * decision diamond: confidence >= threshold ?
 */
export function verifyIdentity(confidence: number): 'VERIFIED' | 'REVIEW_REQUIRED' {
  return confidence >= FACE_VERIFY_THRESHOLD ? 'VERIFIED' : 'REVIEW_REQUIRED';
}
