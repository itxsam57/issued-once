export type OpsSalesSnapshot = {
  days: number;
  currency: string | null;
  grossMinor: number;
  refundedMinor: number;
  netAfterRefundMinor: number;
  paidOrders: number;
  averageOrderMinor: number;
  failedPayments: number;
  exceptionPayments: number;
  byProduct: Array<{ key: string; orders: number }>;
  byCountry: Array<{ key: string; orders: number }>;
  funnel: {
    started: number;
    answered: number;
    physical: number;
    verified: number;
    shipping: number;
    checkout: number;
    paid: number;
  };
};

export interface OpsSalesRepository {
  getSnapshot(input: { days: number; now: Date }): Promise<OpsSalesSnapshot>;
}
