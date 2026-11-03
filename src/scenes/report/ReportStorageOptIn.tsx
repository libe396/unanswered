/** QR preparation status; no additional visitor opt-in/download section. */
export interface ReportStorageAction {
  onPrepare: () => void;
  pending: boolean;
  ready: boolean;
  notice?: string;
}
