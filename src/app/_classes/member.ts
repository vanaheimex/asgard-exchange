export interface MemberPool {
  pool: string;
  assetAdded: string;
  assetWithdrawn: string;
  dateFirstAdded: string;
  dateLastAdded: string;
  liquidityUnits: string;
  runeAdded: string;
  runeWithdrawn: string;
  runeAddress: string;
}

export interface MemberDTO {
  pools: MemberPool[];
}
