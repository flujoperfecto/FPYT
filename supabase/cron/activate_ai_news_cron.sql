do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'refresh-ai-news-daily';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'refresh-ai-news-daily',
    '30 11 * * *',
    $cron$
      select net.http_post(
        url := secrets.project_url || '/functions/v1/refresh-ai-news',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', secrets.cron_secret
        ),
        body := jsonb_build_object('scheduled_at', now())
      )
      from (
        select
          max(decrypted_secret) filter (where name = 'ai_news_project_url') as project_url,
          max(decrypted_secret) filter (where name = 'ai_news_cron_secret') as cron_secret
        from vault.decrypted_secrets
      ) secrets
      where secrets.project_url is not null
        and secrets.cron_secret is not null;
    $cron$
  );
end;
$$;
