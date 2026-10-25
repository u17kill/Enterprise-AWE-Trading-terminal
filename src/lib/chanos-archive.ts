/** Verified against the SEC information table for Chanos & Co LP's 2023 Q3 13F. */
export const CHANOS_ARCHIVE = {
  period: "2023-09-30",
  filedAt: "2023-11-14",
  informationTableUrl: "https://www.sec.gov/Archives/edgar/data/1446440/000117266123003940/xslForm13F_X02/infotable.xml",
  holdings: [
    { issuer: "SPDR SER TR", title: "S&P REGL BKG", cusip: "78464A698", shares: 49_786, valueUsd: 2_079_561 },
    { issuer: "INVESCO QQQ TR", title: "UNIT SER 1", cusip: "46090E103", shares: 2_134, valueUsd: 764_548 },
    { issuer: "ISHARES TR", title: "SHORT TREAS BD", cusip: "464288679", shares: 2_725, valueUsd: 301_031 },
    { issuer: "SPDR SER TR", title: "BLOOMBERG 1-3 MO", cusip: "78468R663", shares: 3_275, valueUsd: 300_711 },
    { issuer: "INFLECTION PT ACQUISITN CRP", title: "CL A ORD SHS", cusip: "G4790U102", shares: 15_000, valueUsd: 153_276 },
    { issuer: "ARES ACQUISITION CORPORATION", title: "COM CL A", cusip: "G33032106", shares: 12_742, valueUsd: 137_104 },
    { issuer: "TRAILBLAZER MERGER CORP I", title: "CL A", cusip: "89278D109", shares: 12_549, valueUsd: 129_631 },
  ],
} as const;
