-- Roles for production. Applied by the platform team.
CREATE ROLE app LOGIN;
CREATE ROLE agent LOGIN;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agent;
ALTER SCHEMA public OWNER TO agent;
