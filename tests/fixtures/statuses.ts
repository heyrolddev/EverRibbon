import type { OrderStatusRow } from "../../src/lib/order-statuses.ts";

/**
 * One shop's steps, shared by every suite that needs them.
 *
 * Copied into a second file once and the two immediately disagreed about
 * whether "delivered" was delivery-only, which is exactly the class of bug
 * these tests exist to catch.
 */
/** The flow a made-to-order shop actually runs — see the seed. */
export const RIBBON: OrderStatusRow[] = [
  { key: "inquiry",       label: "Inquiry",       sortOrder: 10,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: false, isFulfilled: false, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "ink",    hint: null },
  { key: "agreed",        label: "Agreed",        sortOrder: 30,  isOpen: true,  isGate: true,  deliveryOnly: false, commitsStock: false, isFulfilled: false, isCancellation: false, awaitingCustomer: true, customerNote: null, tone: "accent", hint: "Waiting on the deposit." },
  { key: "deposit_paid",  label: "Deposit paid",  sortOrder: 40,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true,  isFulfilled: false, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "ok",     hint: null },
  { key: "proof_sent",    label: "Proof sent",    sortOrder: 50,  isOpen: true,  isGate: true,  deliveryOnly: false, commitsStock: true,  isFulfilled: false, isCancellation: false, awaitingCustomer: true, customerNote: null, tone: "accent", hint: null },
  { key: "in_production", label: "In production", sortOrder: 70,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true,  isFulfilled: false, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "brand",  hint: null },
  // A shop that ships adds this; one that hands over at the counter does not.
  { key: "shipped",       label: "Shipped",       sortOrder: 95,  isOpen: true,  isGate: false, deliveryOnly: true,  commitsStock: true,  isFulfilled: false, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "ink",    hint: null },
  { key: "delivered",     label: "Delivered",     sortOrder: 100, isOpen: false, isGate: false, deliveryOnly: false,  commitsStock: true,  isFulfilled: true, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "ink",    hint: null },
  { key: "cancelled",     label: "Cancelled",     sortOrder: 110, isOpen: false, isGate: false, deliveryOnly: false, commitsStock: false, isFulfilled: false, isCancellation: true, awaitingCustomer: false, customerNote: null, tone: "bad",    hint: null },
];
