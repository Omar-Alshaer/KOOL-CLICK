export const restaurants = [
  {
    id: "r1",
    name: "Pixel Bites",
    image: "../../assets/brand/logo.svg",
    rating: 4.7,
    reviews: 382,
    deliveryTime: "12-18 min",
    priceRange: "$$",
    categories: [
      {
        id: "burgers",
        name: "Burgers",
        items: [
          { id: "m1", name: "Crunch Burger", price: 85, desc: "Smash burger, lettuce, fries" },
          { id: "m2", name: "Double Neon Burger", price: 112, desc: "Double patty + cheese sauce" }
        ]
      },
      {
        id: "wraps",
        name: "Wraps",
        items: [
          { id: "m3", name: "Cheesy Wrap", price: 65, desc: "Chicken wrap + melted cheese" },
          { id: "m4", name: "Ranch Wrap", price: 72, desc: "Crispy chicken + ranch" }
        ]
      }
    ]
  },
  {
    id: "r2",
    name: "Neon Pasta",
    image: "../../assets/brand/logo.svg",
    rating: 4.5,
    reviews: 241,
    deliveryTime: "15-22 min",
    priceRange: "$$$",
    categories: [
      {
        id: "pasta",
        name: "Pasta",
        items: [
          { id: "m5", name: "Alfredo Bowl", price: 95, desc: "Creamy pasta with chicken" },
          { id: "m6", name: "Spicy Red Penne", price: 88, desc: "Arrabbiata sauce + parmesan" }
        ]
      },
      {
        id: "sides",
        name: "Sides",
        items: [
          { id: "m7", name: "Garlic Bread", price: 35, desc: "Toasted bread with garlic butter" },
          { id: "m8", name: "Cheese Bites", price: 44, desc: "Fried mozzarella bites" }
        ]
      }
    ]
  },
  {
    id: "r3",
    name: "Campus Grill",
    image: "../../assets/brand/logo.svg",
    rating: 4.8,
    reviews: 519,
    deliveryTime: "10-16 min",
    priceRange: "$$",
    categories: [
      {
        id: "plates",
        name: "Plates",
        items: [
          { id: "m9", name: "Grilled Chicken Plate", price: 110, desc: "Rice + grilled chicken" },
          { id: "m10", name: "Beef Kofta Plate", price: 124, desc: "Kofta + seasoned rice" }
        ]
      },
      {
        id: "sandwiches",
        name: "Sandwiches",
        items: [
          { id: "m11", name: "BBQ Beef Sandwich", price: 92, desc: "BBQ beef + pickles" },
          { id: "m12", name: "Chicken Club", price: 86, desc: "Grilled chicken + turkey slices" }
        ]
      }
    ]
  }
];
