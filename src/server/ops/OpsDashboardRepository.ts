export type OpsSalesWindow = {
  orders: number;
  grossMinor: number;
};

export type OpsDashboardSnapshot = {
  sales: {
    today: OpsSalesWindow;
    sevenDays: OpsSalesWindow;
    thirtyDays: OpsSalesWindow;
    lifetime: OpsSalesWindow;
    refundedMinor: number;
    averageOrderMinor: number;
  };
  operations: {
    paidIssues: number;
    designing: number;
    review: number;
    production: number;
    transit: number;
    delivered: number;
  };
  attention: {
    paymentExceptions: number;
    designFailures: number;
    manufacturingFailures: number;
    notificationFailures: number;
    supportOpen: number;
  };
  activity: Array<{
    issueCode: string;
    eventType: string;
    source: string;
    createdAt: Date;
  }>;
};

export interface OpsDashboardRepository {
  getDashboard(now: Date): Promise<OpsDashboardSnapshot>;
}
