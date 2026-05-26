/**
 * sanitize-firestore.ts
 *
 * Deep-removes `undefined` values from objects before Firestore writes.
 * Firestore Admin SDK throws a hard error on any `undefined` value —
 * even nested inside metadata objects — crashing the entire stream.
 *
 * Rules:
 *   - Object keys with `undefined` value → key is removed entirely
 *   - Array elements with `undefined` → filtered out
 *   - `null` → preserved (Firestore handles null fine)
 *   - `false`, `0`, `""` → preserved
 *   - Nested objects and arrays → recursively sanitized
 *
 * Usage:
 *   docRef.set(sanitizeForFirestore({ ...data }))
 *   docRef.update(sanitizeForFirestore({ ...update }))
 *
 * Or use the safe wrappers (safeSet, safeUpdate, safeAdd) which call
 * sanitizeForFirestore automatically and catch serialization errors so
 * they never crash the calling stream.
 */

// ── Core sanitizer ────────────────────────────────────────────────────────────

export function sanitizeForFirestore(value: unknown, _path = ""): unknown {
  // Primitives — pass through except undefined
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "object") return value;

  // Arrays — filter out undefined elements, recurse into remaining
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item, i) => sanitizeForFirestore(item, `${_path}[${i}]`));
  }

  // Objects — remove undefined-valued keys, recurse into values
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[sanitizeForFirestore] removed undefined at ${_path ? `${_path}.` : ""}${key}`);
      }
      continue; // drop this key
    }
    cleaned[key] = sanitizeForFirestore(val, `${_path ? `${_path}.` : ""}${key}`);
  }
  return cleaned;
}

// ── Type-safe wrappers ─────────────────────────────────────────────────────────

/**
 * Sanitize and set a Firestore document.
 * Catches serialization failures so they never crash the calling stream.
 * Returns true on success, false on failure.
 */
export async function safeSet(
  docRef: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>,
  options?: FirebaseFirestore.SetOptions
): Promise<boolean> {
  try {
    const clean = sanitizeForFirestore(data) as Record<string, unknown>;
    if (options) {
      await docRef.set(clean, options);
    } else {
      await docRef.set(clean);
    }
    return true;
  } catch (err) {
    console.warn(`[safeSet] Firestore write failed for ${docRef.path}:`, String(err));
    return false;
  }
}

/**
 * Sanitize and update a Firestore document.
 * Catches serialization failures so they never crash the calling stream.
 * Returns true on success, false on failure.
 */
export async function safeUpdate(
  docRef: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const clean = sanitizeForFirestore(data) as Record<string, unknown>;
    await docRef.update(clean);
    return true;
  } catch (err) {
    console.warn(`[safeUpdate] Firestore update failed for ${docRef.path}:`, String(err));
    return false;
  }
}

/**
 * Sanitize and add a document to a Firestore collection.
 * Catches serialization failures so they never crash the calling stream.
 * Returns the new DocumentReference on success, null on failure.
 */
export async function safeAdd(
  collectionRef: FirebaseFirestore.CollectionReference,
  data: Record<string, unknown>
): Promise<FirebaseFirestore.DocumentReference | null> {
  try {
    const clean = sanitizeForFirestore(data) as Record<string, unknown>;
    return await collectionRef.add(clean);
  } catch (err) {
    console.warn(`[safeAdd] Firestore add failed for ${collectionRef.path}:`, String(err));
    return null;
  }
}

/**
 * Sanitize data for a WriteBatch.set() call.
 * Returns the sanitized data so it can be passed to batch.set().
 * Does NOT catch errors — batch.commit() must be wrapped separately.
 */
export function sanitizedBatchData(data: Record<string, unknown>): Record<string, unknown> {
  return sanitizeForFirestore(data) as Record<string, unknown>;
}
