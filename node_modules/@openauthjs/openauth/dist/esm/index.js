// src/index.ts
import {
  createClient
} from "./client.js";
import {
  createSubjects
} from "./subject.js";
import { issuer } from "./issuer.js";
export {
  issuer,
  createSubjects,
  createClient,
  issuer as authorizer
};
