INSERT INTO editions (id, slug, name, year, phase, results_public, public_status_enabled, voting_deadline, is_current)
VALUES ('edition-2026', 'nexavision-2026', 'Nexavision 2026', 2026, 'open', 0, 1, '2026-12-31T20:00:00.000Z', 1);

INSERT INTO countries (id, code, name, flag_emoji) VALUES
('country-se', 'SE', 'Sweden', '🇸🇪'),
('country-it', 'IT', 'Italy', '🇮🇹'),
('country-fr', 'FR', 'France', '🇫🇷'),
('country-no', 'NO', 'Norway', '🇳🇴'),
('country-ua', 'UA', 'Ukraine', '🇺🇦'),
('country-es', 'ES', 'Spain', '🇪🇸'),
('country-pt', 'PT', 'Portugal', '🇵🇹'),
('country-fi', 'FI', 'Finland', '🇫🇮'),
('country-ch', 'CH', 'Switzerland', '🇨🇭'),
('country-nl', 'NL', 'Netherlands', '🇳🇱'),
('country-be', 'BE', 'Belgium', '🇧🇪'),
('country-gb', 'GB', 'United Kingdom', '🇬🇧');

INSERT INTO entries (id, edition_id, country_id, artist, song_title, youtube_url, display_order) VALUES
('entry-se', 'edition-2026', 'country-se', 'Nova Lune', 'Afterglow', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1),
('entry-it', 'edition-2026', 'country-it', 'Luce', 'Senza Fine', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 2),
('entry-fr', 'edition-2026', 'country-fr', 'Étoile', 'Minuit Bleu', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 3),
('entry-no', 'edition-2026', 'country-no', 'Northbound', 'Northern Lights', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 4),
('entry-ua', 'edition-2026', 'country-ua', 'Mriia', 'Golden Sky', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 5),
('entry-es', 'edition-2026', 'country-es', 'Solara', 'Fuego Lento', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 6),
('entry-pt', 'edition-2026', 'country-pt', 'Maré', 'Horizonte', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 7),
('entry-fi', 'edition-2026', 'country-fi', 'Sisu', 'Electric Snow', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 8),
('entry-ch', 'edition-2026', 'country-ch', 'Alpine', 'Echoes', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 9),
('entry-nl', 'edition-2026', 'country-nl', 'Oranje', 'Satellite Heart', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 10),
('entry-be', 'edition-2026', 'country-be', 'Velvet Arc', 'Neon Rain', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 11),
('entry-gb', 'edition-2026', 'country-gb', 'The Meridian', 'One More Night', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 12);

