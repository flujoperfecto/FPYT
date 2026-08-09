-- Los tutoriales nuevos nacen públicos: el link de /materiales que se pega bajo el
-- video de YouTube debe abrir sin fricción. El acceso por email sigue disponible
-- con el switch del panel de administración (tutorials.access_mode = 'email').
alter table public.tutorials alter column access_mode set default 'public';
