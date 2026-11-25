// Solid (filled) 24x24 icons for the "Shop by Interest" tiles. Inner details are holes (fill-rule evenodd).
type IconProps={size?:number;className?:string};
type Icon=(p:IconProps)=>React.ReactElement;

function solid(children:React.ReactNode,evenodd=true):Icon{
  const C=({size=28,className}:IconProps)=><svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule={evenodd?'evenodd':'nonzero'} clipRule={evenodd?'evenodd':'nonzero'} className={className} aria-hidden="true">{children}</svg>;
  return C;
}

const Gamepad=solid(<path d="M7 6h10a5 5 0 0 1 4.9 4l1 5.2a3 3 0 0 1-5.1 2.4L15.6 15H8.4l-2.2 2.6a3 3 0 0 1-5.1-2.4l1-5.2A5 5 0 0 1 7 6zM6 9v1.5H4.5v2H6V14h2v-1.5h1.5v-2H8V9zm10 0a1.1 1.1 0 1 0 0 2.2A1.1 1.1 0 1 0 16 9zm2.3 2.6a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2z"/>);
const Planet=solid(<><circle cx="12" cy="12" r="6.2"/><ellipse cx="12" cy="12" rx="10.6" ry="3.4" transform="rotate(-22 12 12)" fill="none" stroke="currentColor" strokeWidth="1.8"/></>,false);
const Clapper=solid(<><path d="M3 10.5h18V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M2.7 5.4 19.4 2.3a1 1 0 0 1 1.2.8l.6 3.1L3.6 9.5l-.9-4.1zM7.6 4.5l-1.9 3.8 2.6-.5 1.9-3.8zm5.3-1-1.9 3.8 2.6-.5 1.9-3.8z"/></>);
const Tv=solid(<><path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm1 2.5v8h11.5v-8zm14.2 1.3a1 1 0 1 0 0 2 1 1 0 1 0 0-2z"/><path d="M8 2.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></>);
const Music=solid(<path d="M20.5 2.3v13.4a3.2 3.2 0 1 1-2.2-3V7.3l-8.6 1.6v9.3a3.2 3.2 0 1 1-2.2-3V5.2z"/>,false);
const Mountains=solid(<path d="M1 20.5 8.5 7.5l3.3 5.7L15.5 8 23 20.5zM8.5 7.5l-2 3.5 2 1 2-1z"/>);
const Dumbbell=solid(<path d="M1.5 9.5h2v-3h3.5v11H3.5v-3h-2zm15.5-3h3.5v3h2v5h-2v3H17zm-9 4h8v3H8z"/>,false);
const Alien=solid(<path d="M12 2C7 2 3.8 5.6 3.8 10.2c0 5 4.6 10.3 8.2 11.8 3.6-1.5 8.2-6.8 8.2-11.8C20.2 5.6 17 2 12 2zM6.6 10.3c2-.4 4 .7 4.5 2.9-2 .4-4-.7-4.5-2.9zm10.8 0c-.5 2.2-2.5 3.3-4.5 2.9.5-2.2 2.5-3.3 4.5-2.9z"/>);
const Skull=solid(<path d="M12 2a9 9 0 0 0-9 9c0 3 1.5 5.3 4 6.6V21a1 1 0 0 0 1 1h1.6v-2.2h1.6V22h1.6v-2.2h1.6V22H16a1 1 0 0 0 1-1v-3.4c2.5-1.3 4-3.6 4-6.6a9 9 0 0 0-9-9zM8.6 9.3a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6zm6.8 0a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6zM12 14.4l1.3 2.4h-2.6z"/>);
const Palette=solid(<path d="M12 2a10 10 0 0 0 0 20c1.3 0 2.2-.9 2.2-2 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-1.1.9-2 2-2H17a5 5 0 0 0 5-5C22 5.6 17.5 2 12 2zM6.8 9.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2zm2.8-4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2zm5 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2zm3 3.7a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2z"/>);
const Paw=solid(<><path d="M12 11.5c-3.1 0-6.2 4-6.2 6.5 0 1.9 1.4 3 3.1 3 1.3 0 2-.6 3.1-.6s1.8.6 3.1.6c1.7 0 3.1-1.1 3.1-3 0-2.5-3.1-6.5-6.2-6.5z"/><ellipse cx="4.6" cy="10.3" rx="2.1" ry="2.6" transform="rotate(-20 4.6 10.3)"/><ellipse cx="9" cy="5.6" rx="2.2" ry="2.8" transform="rotate(-8 9 5.6)"/><ellipse cx="15" cy="5.6" rx="2.2" ry="2.8" transform="rotate(8 15 5.6)"/><ellipse cx="19.4" cy="10.3" rx="2.1" ry="2.6" transform="rotate(20 19.4 10.3)"/></>,false);
const Car=solid(<><path d="M5 11.2 6.6 7a2 2 0 0 1 1.9-1.3h7a2 2 0 0 1 1.9 1.3l1.6 4.2h1a2 2 0 0 1 2 2V17h-2a2.5 2.5 0 0 0-5 0H9a2.5 2.5 0 0 0-5 0H2v-3.8a2 2 0 0 1 2-2zm2.3 0h9.4l-1.1-3.4H8.4z"/><circle cx="6.5" cy="17.3" r="2"/><circle cx="17.5" cy="17.3" r="2"/></>);
const Burger=solid(<path d="M3 10.3a9 6.6 0 0 1 18 0zm-1 2.2h20v2.6H2zm1 4h18v1.2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/>,false);
const Smiley=solid(<path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM8.6 7.8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2zm6.8 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2zM7 13.5h10a5 5 0 0 1-10 0z"/>);
const Cassette=solid(<path d="M3 4.5h18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zM8 8.5a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6zm8 0a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6zM6.8 19.5l1.6-3.3h7.2l1.6 3.3z"/>);
const Crown=solid(<path d="M2 7.5l5 4.2 5-7.2 5 7.2 5-4.2-2.2 11.5H4.2zM4.2 20.2h15.6V22H4.2z"/>,false);
const Tee=solid(<path d="M8 3 2 6.5 4.5 11 7 9.8V21h10V9.8l2.5 1.2L22 6.5 16 3c-.6 1.5-2.2 2.5-4 2.5S8.6 4.5 8 3z"/>,false);

// Exact slugs first, then keywords inside longer slugs (e.g. "cars-motors"). Default: a tee.
const BY_SLUG:Record<string,Icon>={gaming:Gamepad,games:Gamepad,anime:Planet,movies:Clapper,'movies-tv':Clapper,film:Clapper,television:Tv,tv:Tv,music:Music,nature:Mountains,outdoors:Mountains,'nature-outdoors':Mountains,fitness:Dumbbell,sports:Dumbbell,gym:Dumbbell,'sci-fi':Alien,scifi:Alien,space:Alien,horror:Skull,art:Palette,'art-design':Palette,hobbies:Palette,animals:Paw,pets:Paw,cats:Paw,dogs:Paw,wildlife:Mountains,cars:Car,'cars-motors':Car,motors:Car,food:Burger,'food-drink':Burger,funny:Smiley,humor:Smiley,vintage:Cassette,retro:Cassette,fantasy:Crown};
const KEYWORDS:[string,Icon][]=[['game',Gamepad],['anime',Planet],['movie',Clapper],['tv',Tv],['music',Music],['nature',Mountains],['outdoor',Mountains],['fit',Dumbbell],['sport',Dumbbell],['sci',Alien],['horror',Skull],['art',Palette],['animal',Paw],['pet',Paw],['car',Car],['motor',Car],['food',Burger],['drink',Burger],['fun',Smiley],['vintage',Cassette],['retro',Cassette],['fantasy',Crown]];

export function InterestIcon({slug,size=28}:{slug:string;size?:number}){
  const s=slug.toLowerCase();
  const I=BY_SLUG[s]||KEYWORDS.find(([k])=>s.includes(k))?.[1]||Tee;
  return <I size={size}/>;
}

// Solid orange flame next to "Trending Designs"
export function Flame({size=22}:{size?:number}){
  return <svg className="ps-flame" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path fill="#F97316" d="M12.6 1.8c.6 3.6 4.9 5.8 4.9 11.2a5.5 5.5 0 0 1-11 0c0-2.8 1.4-4.8 3.1-6.3 0 2 .7 3.5 1.9 4.2.3-3.5 1.3-6.2 1.1-9.1z"/><path fill="#FDBA74" d="M12 21.3a3 3 0 0 1-3-3c0-1.8 1.4-2.7 2-4.4.9 1 2 1.9 2 3.6.6-.4 1-1 1.2-1.6.5.6.8 1.4.8 2.4a3 3 0 0 1-3 3z"/></svg>;
}
