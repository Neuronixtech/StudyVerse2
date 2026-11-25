import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { OrderPayment } from "@/features/bookstore/payment";
import { createSeed, SERVER_ANCHOR } from "@/lib/mock/seed";

export const metadata: Metadata = { title: "Order payment" };

export function generateStaticParams() {
  return createSeed(SERVER_ANCHOR).bookOrders.map((o) => ({ orderId: o.id }));
}

export default function Page({ params }: PageProps<"/books/orders/[orderId]/payment">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ orderId }) => (
        <OrderPayment orderId={orderId} />
      ))}
    </Suspense>
  );
}
