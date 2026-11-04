-- Keep the current public community and remove the old default communities.
-- Group rooms and their messages are not affected.
delete from public.rooms
where kind = 'community'
  and name in (
    'Dasturchilar',
    'Medik xodimlar',
    'O''qituvchilar',
    'Talabalar',
    'Tadbirkorlar',
    'Dizaynerlar',
    'DIOR PRODUCTION',
    'Ss',
    'Fikrlar',
    'Random group',
    'Testing',
    'Xabarim rasmiy guruhi'
  );
