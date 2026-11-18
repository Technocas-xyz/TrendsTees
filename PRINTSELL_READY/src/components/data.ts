export type Design = {id:string; name:string; price:number; rating:number; reviews:number; category:string; colors:number; image?:string|null; description?:string|null;};
export const designs:Design[]=[
{id:'1',name:'Dog Mom',price:16.99,rating:4.7,reviews:128,category:'Dogs',colors:5},
{id:'2',name:'Stay Pawsitive',price:16.99,rating:4.8,reviews:96,category:'Dogs',colors:4},
{id:'3',name:'Life Is Better with a Dog',price:17.99,rating:4.8,reviews:96,category:'Dogs',colors:4},
{id:'4',name:'Good Boy Club',price:16.99,rating:4.8,reviews:52,category:'Dogs',colors:4},
{id:'5',name:'Best Friends for Life',price:16.99,rating:4.7,reviews:75,category:'Dogs',colors:4},
{id:'6',name:'Dog Dad',price:14.99,rating:4.7,reviews:84,category:'Dogs',colors:6},
{id:'7',name:'Pawsitively Adorable',price:16.99,rating:4.8,reviews:60,category:'Dogs',colors:4},
{id:'8',name:'Life is Ruff',price:15.99,rating:4.6,reviews:71,category:'Dogs',colors:5},
{id:'9',name:'Cat Mom',price:16.99,rating:4.8,reviews:112,category:'Cats',colors:5},
{id:'10',name:'Horse Lover',price:17.99,rating:4.9,reviews:87,category:'Horses',colors:4},
{id:'11',name:'Rescue Is My Breed',price:16.99,rating:4.8,reviews:103,category:'Rescue & Adoption',colors:4},
{id:'12',name:'Farm Life Is the Best Life',price:17.99,rating:4.7,reviews:74,category:'Farm Animals',colors:4},
];
export const interests=['Animals & Pets','Faith & Inspiration','Fitness & Gym','Gaming','Patriotic','Summer Vibes','Car Enthusiast','Mom Life'];
export const types=[{id:'tshirts',name:'T-Shirts',price:16.99},{id:'hoodies',name:'Hoodies',price:29.99},{id:'sweatshirts',name:'Sweatshirts',price:26.99},{id:'tank-tops',name:'Tank Tops',price:18.99},{id:'long-sleeve',name:'Long Sleeve',price:22.99},{id:'caps',name:'Hats & Caps',price:19.99},{id:'dtf',name:'DTF Transfers',price:4.99}];
export type CartItem={cartId:string;designId:string;designName:string;productId:string;productName:string;color:string|null;size:string;placement:string;quantity:number;unitPrice:number};
// Checkout shipping form. country = country code (US), stateId is used to load the cities, state = state name
export type Shipping={fullName:string;email:string;phone:string;country:string;stateId:string;state:string;city:string;address:string;apartment:string;zip:string;shippingMethod:string};

