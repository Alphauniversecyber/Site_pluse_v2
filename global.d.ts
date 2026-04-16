declare module "server-only";
declare module "*.css";
declare module "pa11y";
declare module "jspdf";
declare module "@hookform/resolvers/zod";
declare module "react-hook-form";

interface PaddleCheckoutEvent {
  name: string;
  data: {
    transaction_id?: string;
    [key: string]: unknown;
  };
}

interface PaddleJs {
  Environment?: {
    set: (environment: "sandbox") => void;
  };
  Initialize: (input: {
    token: string;
    eventCallback?: (event: PaddleCheckoutEvent) => void;
  }) => void;
  Checkout: {
    open: (input: {
      items: Array<{
        priceId: string;
        quantity: number;
      }>;
      discountId?: string;
      customer?: {
        email?: string;
      };
      customData?: Record<string, unknown>;
      settings?: {
        displayMode?: "overlay" | "inline";
        theme?: "light" | "dark";
        locale?: string;
        variant?: "multi-page" | "one-page";
        allowDiscountRemoval?: boolean;
        showAddDiscounts?: boolean;
        successUrl?: string;
      };
    }) => void;
  };
}

interface Window {
  Paddle?: PaddleJs;
}
