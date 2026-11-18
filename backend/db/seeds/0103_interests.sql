-- Seed: starting interests (top-level categories). Admin can rename, hide or add more.
-- Pehle 8 home page pe "Trending Interests" mein dikhenge.

INSERT INTO public.categories
    (category_name, category_slug, description, display_order, category_status, is_trending)
SELECT v.name, v.slug, v.name || ' designs', v.ord, 'active', v.ord <= 8
FROM (VALUES
    ('Animals',    'animals',    1),
    ('Anime',      'anime',      2),
    ('Funny',      'funny',      3),
    ('Gaming',     'gaming',     4),
    ('Music',      'music',      5),
    ('Sports',     'sports',     6),
    ('Vintage',    'vintage',    7),
    ('Food',       'food',       8),
    ('Fantasy',    'fantasy',    9),
    ('Hobbies',    'hobbies',   10),
    ('Movies',     'movies',    11),
    ('Sci-Fi',     'sci-fi',    12),
    ('Television', 'television',13)
) AS v(name, slug, ord)
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories c WHERE lower(c.category_slug) = v.slug
);
