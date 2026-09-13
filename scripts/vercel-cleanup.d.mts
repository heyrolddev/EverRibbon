/** The fields of a Vercel deployment that the cleanup rules actually read. */
export type Deployment = {
  uid: string;
  /** "production", "preview", or absent on older records. */
  target?: string | null;
  state?: string;
  readyState?: string;
  /** Epoch milliseconds. */
  created: number;
  aliasAssigned?: boolean | number;
  alias?: string[];
};

export type Judged = Deployment & {
  action: "keep" | "delete";
  /** Why, in words, so a dry run explains itself rather than just counting. */
  why: string;
};

export type ClassifyOptions = {
  /** The deployment currently serving production. Required; there is no default. */
  liveId: string;
  keepProduction?: number;
  previewAgeDays?: number;
  now?: number;
};

export declare const KEEP: {
  LIVE: string; ALIASED: string; ROLLBACK: string; RECENT: string; UNKNOWN: string;
};

export declare function classify(deployments: Deployment[], opts: ClassifyOptions): Judged[];
