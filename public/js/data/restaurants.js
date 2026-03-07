function buildCategories(prefix, priceShift = 0) {
  return [
    {
      id: "main-meals",
      icon: "🍔",
      name: "وجبات أساسية",
      items: [
        { id: `${prefix}-m1`, icon: "🍔", name: "Burger", price: 95 + priceShift, desc: "Beef patty, cheese, lettuce" },
        { id: `${prefix}-m2`, icon: "🍕", name: "Pizza Slice", price: 75 + priceShift, desc: "Cheesy slice with sauce" },
        { id: `${prefix}-m3`, icon: "🌭", name: "Hot Dog", price: 68 + priceShift, desc: "Classic sausage with mustard" },
        { id: `${prefix}-m4`, icon: "🌮", name: "Taco", price: 72 + priceShift, desc: "Crunchy shell, seasoned beef" },
        { id: `${prefix}-m5`, icon: "🌯", name: "Burrito", price: 88 + priceShift, desc: "Rice, beans, chicken wrap" },
        { id: `${prefix}-m6`, icon: "🍗", name: "Fried Chicken", price: 102 + priceShift, desc: "Crispy chicken pieces" },
        { id: `${prefix}-m7`, icon: "🥪", name: "Sandwich", price: 64 + priceShift, desc: "Fresh toasted sandwich" }
      ]
    },
    {
      id: "quick-bites",
      icon: "🍟",
      name: "أكلات سريعة",
      items: [
        { id: `${prefix}-m8`, icon: "🍟", name: "French Fries", price: 42 + priceShift, desc: "Golden salted fries" },
        { id: `${prefix}-m9`, icon: "🍳", name: "Fried Egg", price: 34 + priceShift, desc: "Sunny-side up egg snack" }
      ]
    },
    {
      id: "desserts",
      icon: "🍩",
      name: "حلويات",
      items: [
        { id: `${prefix}-m10`, icon: "🍩", name: "Donut", price: 36 + priceShift, desc: "Soft glazed donut" },
        { id: `${prefix}-m11`, icon: "🍪", name: "Cookie", price: 24 + priceShift, desc: "Chunky chocolate cookie" },
        { id: `${prefix}-m12`, icon: "🍰", name: "Cake", price: 48 + priceShift, desc: "Vanilla cream cake slice" }
      ]
    },
    {
      id: "drinks",
      icon: "☕",
      name: "مشروبات",
      items: [
        { id: `${prefix}-m13`, icon: "☕", name: "Coffee", price: 32 + priceShift, desc: "Hot brewed coffee" },
        { id: `${prefix}-m14`, icon: "🧋", name: "Bubble Tea", price: 54 + priceShift, desc: "Milk tea with pearls" },
        { id: `${prefix}-m15`, icon: "🥤", name: "Soda Cup", price: 28 + priceShift, desc: "Cold fizzy soda" },
        { id: `${prefix}-m16`, icon: "🧃", name: "Juice Box", price: 26 + priceShift, desc: "Fruit juice box" },
        { id: `${prefix}-m17`, icon: "🍹", name: "Cocktail", price: 58 + priceShift, desc: "Fresh mixed mocktail" }
      ]
    }
  ];
}

export const restaurants = [
  {
    id: "r1",
    name: "Pixel Bites",
    image: "../../assets/temp/logo.png",
    rating: 4.7,
    reviews: 382,
    deliveryTime: "12-18 min",
    priceRange: "$$",
    categories: buildCategories("r1", 0)
  },
  {
    id: "r2",
    name: "Neon Pasta",
    image: "../../assets/temp/logo.png",
    rating: 4.5,
    reviews: 241,
    deliveryTime: "15-22 min",
    priceRange: "$$$",
    categories: buildCategories("r2", 8)
  },
  {
    id: "r3",
    name: "Campus Grill",
    image: "../../assets/temp/logo.png",
    rating: 4.8,
    reviews: 519,
    deliveryTime: "10-16 min",
    priceRange: "$$",
    categories: buildCategories("r3", 4)
  }
];
