// src/utils/serialize.js
'use strict';

/**
 * Returns a plain object where _id is renamed to id and __v is removed.
 * Works on lean objects and Mongoose documents (including nested populated objects).
 */
function withId(doc) {
  if (doc === null || doc === undefined) return doc;

  if (Array.isArray(doc)) {
    return doc.map(withId);
  }

  let obj = doc;
  if (typeof doc.toObject === 'function') {
    obj = doc.toObject();
  }

  if (obj === null || typeof obj !== 'object' || obj.constructor !== Object) {
    return obj;
  }

  const { _id, __v, ...rest } = obj;
  const result = {};

  if (_id !== undefined) {
    result.id = _id;
  }

  for (const [key, val] of Object.entries(rest)) {
    result[key] = withId(val);
  }

  return result;
}

module.exports = { withId };
