# StudyVerse Bookstore --- Product Specification

**Document:** `BOOKSTORE_SPEC.md`\
**Product:** StudyVerse\
**Scope:** Phase 1 --- UI prototype with mock data and simulated
interactions\
**Status:** Brainstorming decisions consolidated; open policy details
listed at the end\
**Last updated:** 14 November 2026

------------------------------------------------------------------------

## 1. Purpose and scope

The StudyVerse Bookstore is a native module within the existing
StudyVerse learning platform. It allows visitors and learners to browse
and purchase physical educational books without requiring an active
learning subscription.

The bookstore must use the same visual identity and experience as the
main StudyVerse platform. It is not a separately branded store.

### Phase 1 objective

Build and validate the complete customer-facing and admin-facing
bookstore experience using **Next.js, mock data, and simulated
interactions**.

Phase 1 is a UI prototype only. It does not include production database,
backend, authentication, payment-gateway, email-delivery, courier, or
inventory integrations.

### Explicit exclusions for Phase 1

-   Digital books, PDFs, or downloadable products
-   Payment gateway integration
-   Automated UPI/bank reconciliation
-   Courier API integration
-   Automated email delivery
-   Supplier purchase orders and full procurement workflows
-   Inventory valuation/accounting
-   Coupon engine, cart-wide discounts, festival offers, or bundle
    discounts
-   Split shipments for a single order

The existing StudyVerse `PLAN.md` is out of scope and must remain
unchanged. This document is a separate bookstore specification.

------------------------------------------------------------------------

## 2. Product principles

1.  **Native StudyVerse experience:** Reuse the main platform's colors,
    typography, components, spacing, and interaction patterns.
2.  **Subscription-independent purchases:** A customer does not need an
    active learning subscription to buy books.
3.  **Physical products only:** Every catalog item represents a physical
    book.
4.  **Manual payment first:** Customers transfer money using the
    displayed UPI or bank details and submit payment information for
    admin verification.
5.  **Explicit inventory control:** Never silently remove unavailable
    products or accept backorders.
6.  **Auditable administration:** Important changes must have a visible
    history, including who performed them and when.
7.  **Prototype honestly:** Mock interactions should clearly simulate
    workflows without implying that real payments, shipments, or
    notifications have occurred.

------------------------------------------------------------------------

## 3. Users and access

### 3.1 Customer types

-   **Visitor:** Can browse the storefront, search and filter books,
    view product details, and add books to a cart. Must log in before
    checkout.
-   **Learner:** Has a StudyVerse account. Can purchase books regardless
    of whether their learning subscription is active.
-   **Admin:** Uses a separate Bookstore area in the admin sidebar to
    manage catalog, inventory, orders, payments, fulfillment, returns,
    reports, and settings.

### 3.2 Cart and authentication

-   Visitors may add books to the cart.
-   Checkout requires login.
-   When a visitor is prompted to log in, their cart must be preserved.
-   After successful login, the cart is associated with the learner's
    account and checkout can continue.
-   The UI prototype should simulate this transition without requiring
    real authentication integration.

### 3.3 Admin roles and permissions

The bookstore has separate configurable permissions for Owner and Staff.

-   **Owner:** Full bookstore access, including store settings and staff
    permission configuration.
-   **Staff:** Access is determined by configurable permissions.

Permission examples:

-   Add and edit books
-   Manage product photos
-   Adjust inventory
-   Change prices
-   Verify payments
-   Process orders
-   Manage dispatch
-   Approve or reject cancellations
-   Review and approve returns
-   Record refunds
-   View reports

Store settings are Owner-only. The prototype should show
permission-aware navigation and disabled/hidden actions where
appropriate.

------------------------------------------------------------------------

## 4. Customer storefront

### 4.1 Navigation

-   Add a **Bookstore** link to the main StudyVerse top navigation.
-   The link is visible to visitors and learners.
-   Add a cart icon with an item-count badge.
-   The bookstore should feel like another StudyVerse module, not a
    separate website.

### 4.2 Storefront landing page

The landing page should support:

-   Search by book title, author, or ISBN
-   Browse by exam category
-   Browse by subject
-   New arrivals
-   Popular books
-   Relevant featured books or collections
-   Clear access to filters and sorting
-   Cart access

All displayed content in the prototype comes from mock data.

### 4.3 Catalog and discovery

**Search fields:** - Title - Author - ISBN

**Browse dimensions:** - Exam category - Subject

**Filters:** - Price - Availability - Publisher

**Sorting:** - Price - Newest arrivals - Popularity

### 4.4 Product listing cards

Each product card should show, where available:

-   Primary cover image
-   Book title
-   Author
-   Exam category or subject
-   MRP
-   Selling price
-   Discount presentation
-   Stock state
-   Quick access to product details

Out-of-stock products remain visible with an **Out of Stock** label.
Purchase actions must be disabled for unavailable stock.

### 4.5 Product detail page

The product page should include:

-   Multiple-photo gallery
-   Designated primary cover image
-   Product title
-   Author
-   Publisher
-   ISBN
-   Exam category
-   Subject
-   Description
-   MRP
-   Selling price
-   Discount
-   Available stock state
-   Language
-   Edition
-   Quantity selector
-   Estimated delivery information
-   Related books

ISBN, publisher, author, edition, and language may be omitted when
unavailable.

### 4.6 Product photos

Each product supports multiple photos.

-   One photo is designated as the primary cover image.
-   Admin can add multiple photos.
-   Admin can reorder gallery photos.
-   Admin can remove photos.
-   The storefront uses the primary image on listing cards and presents
    the remaining images in the product gallery.

### 4.7 Product and edition model

Each edition/language combination is a separate product listing with its
own price and inventory. Do not model different editions or languages as
selectable variants within one product for Phase 1.

------------------------------------------------------------------------

## 5. Cart and checkout

### 5.1 Cart behavior

-   Guests can add products to the cart.
-   The cart displays book, selected quantity, unit price, line total,
    and order subtotal.
-   Customers can change quantities or remove items.
-   Cart contents must persist through the login prompt.
-   If a product becomes unavailable or has insufficient stock before
    checkout, keep it in the cart but block checkout until the customer
    adjusts the quantity or removes the item.
-   Do not silently remove unavailable products.
-   Do not accept backorders.

### 5.2 Address book

Customers can save multiple delivery addresses, select one at checkout,
and choose a default address.

Address fields:

-   Full name
-   Mobile number
-   House/building and street
-   Locality
-   City
-   State
-   PIN code
-   Optional delivery instructions

### 5.3 Shipping charges

Admin can configure:

-   Flat shipping charges
-   A free-shipping threshold

Location-based shipping charges may be considered later, but are not
required in the initial prototype.

The checkout must clearly show item subtotal, shipping charges,
discounts if applicable at product level, and final payable amount.

### 5.4 Multi-book checkout

A cart containing multiple books creates one combined order with
individual line items and quantities.

If one item in a multi-book order cannot be fulfilled, hold the entire
order and notify the customer. Partial shipment is not supported in
Phase 1.

------------------------------------------------------------------------

## 6. Manual payment workflow

### 6.1 Payment method

Manual payment is used initially. The checkout/payment screen displays
configured StudyVerse payment details, such as:

-   UPI ID
-   UPI QR code
-   Bank transfer details

These details are mock/configurable UI data during Phase 1.

### 6.2 Customer payment submission

After placing an order, the customer:

1.  Sees the order amount and payment instructions.
2.  Makes the UPI or bank transfer outside StudyVerse.
3.  Submits the transaction reference.
4.  Confirms the amount paid.
5.  May upload an optional payment screenshot.

The screenshot is supporting information only. It is not proof of
payment.

### 6.3 Admin verification

Admin independently verifies the actual payment in the relevant UPI/bank
account before approving it.

Admin can:

-   Approve payment
-   Reject payment with a mandatory reason

On rejection, the customer can correct the payment information and
resubmit it against the same order. A new order should not be required
solely because a payment submission was rejected.

On approval, the order automatically moves to **Processing**.

### 6.4 Payment states

-   Pending Payment
-   Payment Verification
-   Payment Confirmed
-   Payment Rejected

The order lifecycle also includes fulfillment and terminal states
described in Section 7.

### 6.5 Payment audit details

Admin order details must display:

-   Payment method
-   Transaction reference
-   Amount submitted
-   Optional screenshot
-   Payment submission date/time
-   Verification decision
-   Rejection reason, if applicable
-   Admin who made the decision and timestamp

------------------------------------------------------------------------

## 7. Orders, inventory reservation, and fulfillment

### 7.1 Customer-visible order lifecycle

Primary lifecycle:

`Pending Payment → Payment Verification → Payment Confirmed → Processing → Shipped → Delivered`

Additional states:

-   Payment Rejected
-   Cancelled
-   Returned
-   Refunded

The UI should make the current state and order timeline easy to
understand.

### 7.2 Inventory reservation

-   Stock is reserved for 24 hours after order placement.
-   If payment details are submitted within that reservation window, the
    stock remains reserved while admin verification is pending.
-   If payment details are not submitted within the reservation window,
    the reservation expires.
-   Pending payment verification must remain prominent in the admin
    interface.
-   Admin should be able to follow up on pending verification.
-   Do not silently cancel an order merely because admin verification is
    delayed.

**Open policy detail:** Confirm the exact reservation start timestamp
and the precise behavior when a customer submits payment close to the
24-hour deadline before production implementation. The current working
assumption is that the 24-hour clock starts at order creation.

### 7.3 Order price snapshot

The order stores a snapshot of product prices at the time the order is
placed. Later catalog price changes must not alter existing order
totals.

### 7.4 Fulfillment

Both admin-managed dispatch and external courier services are supported.

Admin can record:

-   Courier company
-   Tracking number
-   Dispatch details
-   Manual delivery status updates

No courier API integration is included in Phase 1.

### 7.5 Admin order editing

Before dispatch, authorized admins can make limited edits:

-   Quantities
-   Delivery address
-   Order items

Any edit must recalculate totals and be recorded in audit history.
Changes affecting the amount already paid must be clearly flagged and
handled explicitly; the prototype must not silently change the payment
amount.

### 7.6 Cancellation

-   Before shipping, a customer can request cancellation.
-   After payment approval but before dispatch, cancellation is a
    request that admin can approve or reject.
-   If approved, admin records manual refund details.
-   After dispatch, the customer must use the return workflow.

------------------------------------------------------------------------

## 8. Returns, replacements, and refunds

### 8.1 Eligibility

For damaged, defective, or incorrect books, customers may submit a
return/replacement/refund request within **7 days after delivery**.

-   Customer provides a reason.
-   Customer may attach evidence such as photos.
-   Admin reviews the request and supporting evidence.
-   General change-of-mind returns are not included in the initial
    scope.

### 8.2 Return workflow

`Return Requested → Admin Review → Approved / Rejected → Replacement or Refund → Resolved`

Admin can:

-   Approve the request
-   Reject the request with an explanation
-   Arrange a replacement
-   Record a refund
-   Mark the case resolved

### 8.3 Refund handling

Refunds are processed externally through UPI or bank transfer in Phase
1.

Admin records:

-   Refund amount
-   Refund method
-   Refund reference
-   Completion status
-   Admin and timestamp

### 8.4 Replacement inventory

Replacement handling must be represented in the UI and inventory
history. Exact stock reservation and return-shipping rules remain open
policy decisions before live commerce.

------------------------------------------------------------------------

## 9. Admin bookstore module

The admin interface has a dedicated **Bookstore** section in the
existing StudyVerse admin sidebar.

### 9.1 Dashboard

Dashboard metrics and queues:

-   Total orders
-   Pending payment verification
-   Payments awaiting review
-   Orders ready for processing
-   Orders awaiting shipment
-   Shipped orders
-   Low-stock products
-   Out-of-stock products
-   Recent activity

The dashboard should prioritize actions that require admin attention.

### 9.2 Book and inventory management

Admin book list should support:

-   Search and filtering
-   Product status
-   Stock quantity
-   Low-stock indication
-   Price display
-   Quick edit access

Product lifecycle:

`Draft → Published → Archived`

Rules:

-   Draft products are not shown in the active storefront.
-   Published products appear in the storefront.
-   Published products with zero stock remain visible as Out of Stock.
-   Archived products are removed from the active storefront.
-   Historical order records remain intact after archival.

### 9.3 Add/edit book

Product metadata:

  Field             Requirement
  ----------------- -----------------------------
  Title             Required
  Author            Optional if unavailable
  Publisher         Optional if unavailable
  ISBN              Optional if unavailable
  Exam category     Supported
  Subject           Supported
  Description       Supported
  Photos            Multiple; one primary image
  MRP               Required
  Selling price     Required
  Available stock   Required
  Language          Optional if unavailable
  Edition           Optional if unavailable

### 9.4 Inventory operations

Admin can:

-   Add stock
-   Remove damaged stock
-   Correct inventory

Every adjustment records a reason, the quantity change, who made it, and
when.

Low-stock threshold is configurable. Default threshold: **5 copies**.

### 9.5 Orders and payment verification

Order list should support status-based filtering and make pending
payment verification prominent.

Order detail includes:

-   Customer details
-   Ordered books and quantities
-   Item subtotal
-   Shipping charges
-   Total
-   Payment method
-   Transaction reference
-   Optional screenshot
-   Payment submission date
-   Delivery address
-   Order timeline
-   Audit history

Actions depend on role permissions.

### 9.6 Dispatch management

Admin can move orders through processing and shipment states, enter
courier and tracking details, and update delivery status manually.

### 9.7 Returns and refunds

Provide a dedicated queue and detail screen for return requests, review
decisions, replacement/refund actions, refund references, and resolution
status.

### 9.8 Reports

Reports should include:

-   Total sales/revenue
-   Number of orders
-   Paid, pending, and rejected payments
-   Best-selling books
-   Low-stock and out-of-stock products
-   Cancelled and returned orders
-   Refund totals
-   Sales by date range

### 9.9 Store settings

Owner-only settings include:

-   Payment instructions and UPI/bank details
-   Shipping charges
-   Free-shipping threshold
-   Low-stock threshold
-   Staff permission configuration
-   Other bookstore-level configuration

------------------------------------------------------------------------

## 10. Notifications

### 10.1 Customer notifications

The intended customer notification events are:

-   Payment submission received
-   Payment approved
-   Payment rejected
-   Order processing
-   Order shipped
-   Order delivered
-   Order cancellation
-   Refund update

Channels:

-   In-app notification
-   Email notification

Actual email delivery is deferred. Phase 1 simulates notifications in
the UI.

### 10.2 Admin notifications

Admin dashboard notifications for:

-   New orders
-   Payment submissions
-   Pending payment verification
-   Low-stock products
-   Out-of-stock products
-   Return requests
-   Cancellation requests
-   Failed or expired stock reservations

Optional email alerts may be represented as a future setting, but are
not sent in the prototype.

------------------------------------------------------------------------

## 11. Discounts and pricing

Phase 1 supports product-level pricing:

-   MRP
-   Selling price
-   Calculated discount presentation

Do not build a coupon engine or cart-wide discount system in Phase 1. No
festival, bundle, or promotional coupon logic is included.

Price changes apply only to new orders. Existing orders retain their
price snapshot.

------------------------------------------------------------------------

## 12. Required UI screens

### 12.1 Customer screens

1.  Bookstore landing page
2.  Book catalog/listing
3.  Product detail
4.  Cart
5.  Login prompt/return-to-checkout state
6.  Address selection and checkout
7.  Manual payment instructions and submission
8.  Order confirmation
9.  My Orders
10. Order detail and tracking timeline
11. Return/cancellation request flow
12. Saved address management

### 12.2 Admin screens

1.  Bookstore dashboard
2.  Book list and inventory
3.  Add book
4.  Edit book and photo gallery management
5.  Stock adjustment
6.  Orders list
7.  Order detail and payment verification
8.  Dispatch management
9.  Returns and refunds
10. Reports
11. Store settings
12. Staff permission configuration

### 12.3 Responsive behavior

All customer and admin screens must be responsive across:

-   Desktop
-   Tablet
-   Mobile

Mobile layouts must preserve essential actions and status visibility
rather than merely shrinking desktop tables.

------------------------------------------------------------------------

## 13. UI prototype behavior and mock data

The prototype should provide realistic simulated interactions for the
key journeys:

### Customer journey

1.  Open Bookstore from the StudyVerse navbar.
2.  Search, browse, filter, and sort books.
3.  Open a product and inspect its gallery/details.
4.  Add one or more books to the cart.
5.  Attempt checkout as a guest and receive a login prompt.
6.  Continue after simulated login with cart contents preserved.
7.  Select or add a delivery address.
8.  Review shipping and order totals.
9.  Place the order.
10. View UPI/bank payment instructions.
11. Submit mock transaction details and optional screenshot.
12. View payment/order status in My Orders.
13. View simulated shipment tracking.
14. Submit a mock cancellation or return request where eligible.

### Admin journey

1.  Open the Bookstore section from the admin sidebar.
2.  Review dashboard queues and alerts.
3.  Create or edit a book, including multiple photos and primary-image
    selection.
4.  Publish or archive a product.
5.  Adjust stock with a reason.
6.  Open a new order and inspect payment information.
7.  Approve or reject a payment with a reason where required.
8.  Process an approved order.
9.  Record courier and tracking information.
10. Update shipment status.
11. Review cancellation and return requests.
12. Record a replacement or refund.
13. Inspect reports and audit history.
14. Change settings where permitted.

Mock data should include realistic examples across available, low-stock,
out-of-stock, draft, published, archived, pending-payment,
payment-review, processing, shipped, delivered, cancelled, and returned
states.

All simulated actions should be visually clear as prototype behavior. Do
not imply a real transfer, payment verification, shipment, refund, or
email has occurred.

------------------------------------------------------------------------

## 14. Visual and interaction requirements

-   Reuse StudyVerse's existing theme exactly: colors, typography,
    buttons, cards, forms, navigation, spacing, and component language.
-   Do not introduce a separate bookstore brand identity.
-   Keep customer and admin experiences visually consistent with their
    corresponding existing StudyVerse areas.
-   Use clear status labels and timelines.
-   Make stock availability and payable totals unambiguous.
-   Provide loading, empty, error, disabled, and success states for
    major interactions.
-   Use confirmation steps for destructive or financially meaningful
    actions.
-   Maintain accessibility basics: readable contrast, visible focus,
    labels, and keyboard-operable controls.

------------------------------------------------------------------------

## 15. Business rules summary

  -----------------------------------------------------------------------
  Area                                Rule
  ----------------------------------- -----------------------------------
  Product type                        Physical books only

  Subscription                        Not required for bookstore
                                      purchases

  Browsing                            Visitors and learners

  Checkout                            Login required

  Payment                             Manual UPI/bank transfer

  Payment proof                       Transaction reference and amount;
                                      optional screenshot

  Verification                        Admin independently verifies actual
                                      receipt

  Payment rejection                   Reason mandatory; customer can
                                      resubmit on same order

  Shipping                            India-wide delivery intent

  Shipping price                      Admin flat fee and free-shipping
                                      threshold

  Inventory                           Reserve for 24 hours after order
                                      placement (working assumption)

  Pending verification                Keep stock reserved after timely
                                      submission until admin decision

  Out of stock                        Visible, purchase disabled

  Backorders                          Not supported

  Multi-item order                    One combined order

  Fulfillment failure                 Hold entire order; no partial
                                      shipment

  Price changes                       Existing order price snapshot is
                                      immutable

  Cancellation                        Request before dispatch; return
                                      flow after dispatch

  Returns                             Damaged, defective, or incorrect
                                      books within 7 days of delivery

  Change of mind                      Not included initially

  Refunds                             External UPI/bank transfer; admin
                                      records reference

  Dispatch                            Manual courier and tracking entry

  Delivery updates                    Manual

  Low-stock default                   5 copies

  Product lifecycle                   Draft, Published, Archived

  Discounts                           Product-level MRP/selling price
                                      only

  Notifications                       In-app and email intended; email
                                      simulated in prototype

  Audit                               Key pricing, stock, payment, order,
                                      and refund actions
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 16. Open decisions before production commerce

These items do not block the UI prototype, but must be resolved before
enabling real orders and payments.

1.  **Reservation clock:** Confirm that the 24-hour stock reservation
    starts at order creation and define exact boundary behavior.
2.  **Rejected payment deadline:** Decide how long a customer has to
    correct and resubmit a rejected payment before the order/reservation
    is released.
3.  **PIN-code serviceability:** Decide how to validate delivery
    coverage and what happens for unsupported PIN codes.
4.  **Return logistics:** Define who pays return shipping for damaged,
    defective, or incorrect books and how pickup/drop-off is arranged.
5.  **Replacement stock:** Define when replacement stock is reserved and
    how returned/damaged inventory is handled.
6.  **Payment verification operations:** Define who can verify payments,
    expected review time, and escalation for long-pending submissions.
7.  **Order edits after payment:** Define how additional payment or
    partial refund is handled if an authorized admin changes an order
    total before dispatch.
8.  **Taxes and invoices:** Confirm applicable tax display, invoice
    generation, and record-keeping requirements before production
    launch.

### Important operational warning

A payment screenshot is not reliable proof that money has reached the
business account. The production workflow must require independent
verification against the actual UPI/bank transaction before an order is
marked paid or released for fulfillment.

------------------------------------------------------------------------

## 17. Suggested implementation sequence for the UI prototype

This is a UI sequencing recommendation, not a backend architecture or
production delivery commitment.

1.  Establish the shared StudyVerse theme and bookstore navigation
    entry.
2.  Build storefront landing page, catalog, filters, and product cards.
3.  Build product detail and multi-photo gallery.
4.  Build cart, guest login prompt, and cart persistence simulation.
5.  Build address selection, shipping calculation, and checkout.
6.  Build manual payment instruction/submission and order confirmation
    screens.
7.  Build My Orders and order timeline.
8.  Build admin dashboard and book/inventory management.
9.  Build admin order/payment verification and dispatch workflows.
10. Build returns/refunds, reports, settings, and permission-aware
    states.
11. Validate desktop, tablet, and mobile journeys end to end.

Start with the customer storefront and core purchase journey, then build
the admin workflows needed to operate that journey.

------------------------------------------------------------------------

## 18. Scope guardrails

Do not expand Phase 1 into a full marketplace or warehouse-management
system. The goal is to validate a coherent bookstore experience inside
StudyVerse.

Any proposed feature should be challenged against three questions:

1.  Is it required for a customer to discover, order, pay for, and
    receive a book?
2.  Is it required for an admin to verify payment, manage stock, and
    fulfill that order safely?
3.  Can it be represented convincingly with mock data in the UI
    prototype?

If the answer to all three is no, defer it.
