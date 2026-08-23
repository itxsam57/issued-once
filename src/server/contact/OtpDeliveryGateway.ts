export interface OtpDeliveryGateway {
  sendOtp(input: {
    email: string;
    code: string;
    challengeId: string;
  }): Promise<{ providerMessageId: string }>;
}
