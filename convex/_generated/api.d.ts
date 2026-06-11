/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as boards from "../boards.js";
import type * as cardWatchers from "../cardWatchers.js";
import type * as cards from "../cards.js";
import type * as columns from "../columns.js";
import type * as commentReactions from "../commentReactions.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as documentLinks from "../documentLinks.js";
import type * as documents from "../documents.js";
import type * as htmlDocs from "../htmlDocs.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as labels from "../labels.js";
import type * as lib_legacyPassword from "../lib/legacyPassword.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as mcpHttp from "../mcpHttp.js";
import type * as mcpKeys from "../mcpKeys.js";
import type * as members from "../members.js";
import type * as migrateCleanup from "../migrateCleanup.js";
import type * as notifications from "../notifications.js";
import type * as presence from "../presence.js";
import type * as secretGroups from "../secretGroups.js";
import type * as secrets from "../secrets.js";
import type * as timeTracking from "../timeTracking.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";
import type * as webhookActions from "../webhookActions.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attachments: typeof attachments;
  auth: typeof auth;
  boards: typeof boards;
  cardWatchers: typeof cardWatchers;
  cards: typeof cards;
  columns: typeof columns;
  commentReactions: typeof commentReactions;
  comments: typeof comments;
  crons: typeof crons;
  documentLinks: typeof documentLinks;
  documents: typeof documents;
  htmlDocs: typeof htmlDocs;
  http: typeof http;
  invites: typeof invites;
  labels: typeof labels;
  "lib/legacyPassword": typeof lib_legacyPassword;
  "lib/rbac": typeof lib_rbac;
  mcpHttp: typeof mcpHttp;
  mcpKeys: typeof mcpKeys;
  members: typeof members;
  migrateCleanup: typeof migrateCleanup;
  notifications: typeof notifications;
  presence: typeof presence;
  secretGroups: typeof secretGroups;
  secrets: typeof secrets;
  timeTracking: typeof timeTracking;
  users: typeof users;
  versions: typeof versions;
  webhookActions: typeof webhookActions;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
