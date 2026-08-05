-- A fresh environment must not run the paid AI workflow before its private
-- secrets have been configured and a manual refresh has been verified. The
-- operational activation script recreates this job with a 120-second pg_net
-- timeout once that validation succeeds.
do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'refresh-ai-news-daily';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;
