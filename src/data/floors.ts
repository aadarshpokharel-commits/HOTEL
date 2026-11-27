export type HotelFloor = {
  id: number;
  level: string;
  name: string;
  shortName: string;
  description: string;
  detail: string;
  tag: string;
  /** Nightly rate, for floors that can be booked (not the lobby). */
  rate?: FloorRate;
};

export type FloorRate = {
  /** Price per night, in whole euros. */
  amount: number;
  /** Shown above the price, e.g. "Residence" or "Penthouse". */
  category: string;
  /** Short line under the price. */
  note: string;
};

// Placeholder nightly rates. Edit them here: every price label and the
// booking panel read from this one place.
const RESIDENCE_NOTE = "Per night · up to 2 guests";

const euro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatRate(rate: FloorRate) {
  return euro.format(rate.amount);
}

export const floors: HotelFloor[] = [
  {
    id: 0,
    level: "Ground floor",
    name: "The Reception",
    shortName: "Reception & lobby",
    description:
      "A gracious Milanese welcome, with a sculptural walnut reception, fresh floral arrangements, collected artwork, and a quiet guest lounge.",
    detail: "Reception · floral lounge · art",
    tag: "A considered welcome",
  },
  {
    id: 1,
    level: "First floor",
    name: "Tavola Residence",
    shortName: "One-bedroom residence",
    description:
      "An Italian-inspired residence with a bedroom, open living hall, marble bathroom, and separate private toilet.",
    detail: "Bedroom · hall · bath · toilet",
    tag: "The art of gathering",
    rate: { amount: 680, category: "Residence", note: RESIDENCE_NOTE },
  },
  {
    id: 2,
    level: "Second floor",
    name: "The Rooms",
    shortName: "One-bedroom residence",
    description:
      "Soft natural textures bring a slower pace to this bedroom, living hall, marble bathroom, and separate private toilet.",
    detail: "Bedroom · hall · bath · toilet",
    tag: "A softer kind of stay",
    rate: { amount: 720, category: "Residence", note: RESIDENCE_NOTE },
  },
  {
    id: 3,
    level: "Third floor",
    name: "The Suites",
    shortName: "One-bedroom residence",
    description:
      "A more generous bedroom and living hall pair with a marble bathroom and a separate private toilet.",
    detail: "Bedroom · hall · bath · toilet",
    tag: "Space to settle in",
    rate: { amount: 840, category: "Suite residence", note: RESIDENCE_NOTE },
  },
  {
    id: 4,
    level: "Fourth floor",
    name: "Casa Aurelia",
    shortName: "One-bedroom residence",
    description:
      "An elevated hideaway with one bedroom, a private living hall, marble bathroom, and separate private toilet.",
    detail: "Bedroom · hall · bath · toilet",
    tag: "Your own private world",
    rate: { amount: 960, category: "Signature residence", note: RESIDENCE_NOTE },
  },
  {
    id: 5,
    level: "Fifth floor",
    name: "The Penthouse",
    shortName: "Penthouse with terrace",
    description:
      "Above the rooftops, enjoy a bedroom, panoramic living hall, marble bathroom, and separate private toilet.",
    detail: "Bedroom · hall · bath · toilet",
    tag: "Above it all",
    rate: { amount: 2400, category: "Penthouse", note: "Per night · private terrace & plunge pool" },
  },
];
