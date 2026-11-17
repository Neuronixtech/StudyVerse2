import type { Metadata } from "next";
import { BookstoreLanding } from "@/features/bookstore/storefront";

export const metadata: Metadata = {
  title: "Bookstore",
  description: "Printed JEE and MHT-CET workbooks, solved papers and revision notes delivered across India.",
};

export default function BookstorePage() {
  return <BookstoreLanding />;
}
