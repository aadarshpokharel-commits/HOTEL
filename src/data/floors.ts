export type HotelFloor = {
  id: number;
  level: string;
  name: string;
  shortName: string;
  description: string;
  detail: string;
  tag: string;
};

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
  },
  {
    id: 5,
    level: "Fifth floor",
    name: "The Penthouse",
    shortName: "One-bedroom residence",
    description:
      "Above the rooftops, enjoy a bedroom, panoramic living hall, marble bathroom, and separate private toilet.",
    detail: "Bedroom · hall · bath · toilet",
    tag: "Above it all",
  },
];
