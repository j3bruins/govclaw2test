create table organizations (
  id text primary key,
  name text not null,
  legal_name text not null,
  uei text not null default '',
  cage text not null default '',
  entity_type text not null,
  socioeconomic text not null default '',
  city text not null default '',
  state text not null default '',
  naics text not null default '',
  summary text not null default '',
  capabilities text not null default '',
  past_performance text not null default '',
  certifications text not null default '',
  annual_revenue numeric not null default 0,
  employee_count integer not null default 0,
  status text not null,
  featured boolean not null default false,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index organizations_name_idx on organizations (name);
create index organizations_status_idx on organizations (status);
create index organizations_state_idx on organizations (state);
create index organizations_featured_idx on organizations (featured desc, name);

create table team_members (
  id text primary key,
  name text not null,
  kind text not null,
  role text not null,
  specialty text not null default '',
  created_at timestamptz not null default now()
);

create table assignments (
  id text primary key,
  organization_id text not null references organizations (id),
  member_id text not null references team_members (id),
  pod_role text not null,
  unique (organization_id, member_id)
);

create index assignments_org_idx on assignments (organization_id);

create table opportunities (
  id text primary key,
  portal text not null,
  external_id text not null,
  number text not null,
  title text not null,
  agency text not null,
  agency_code text not null default '',
  instrument text not null,
  naics text not null default '',
  set_aside text not null default '',
  posted_on text,
  closes_on text,
  award_ceiling numeric,
  description text not null default '',
  eligibility text not null default '',
  url text not null default '',
  created_at timestamptz not null default now(),
  unique (portal, external_id)
);

create index opportunities_close_idx on opportunities (closes_on);

create table documents (
  id text primary key,
  organization_id text references organizations (id),
  opportunity_id text references opportunities (id),
  kind text not null,
  filename text not null,
  media_type text not null default 'text/plain',
  byte_size integer not null default 0,
  extracted_text text not null default '',
  extraction_summary text not null default '',
  uploaded_by text not null default '',
  content_base64 text,
  created_at timestamptz not null default now()
);

create index documents_org_idx on documents (organization_id);
create index documents_opp_idx on documents (opportunity_id);

create table profile_facts (
  id text primary key,
  organization_id text not null references organizations (id),
  field text not null,
  value text not null,
  source_label text not null default '',
  created_at timestamptz not null default now()
);

create index profile_facts_org_idx on profile_facts (organization_id, created_at desc);

create table profile_suggestions (
  id text primary key,
  organization_id text not null references organizations (id),
  field text not null,
  value text not null,
  source_label text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index profile_suggestions_org_idx on profile_suggestions (organization_id, status);

create table matches (
  id text primary key,
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  score integer not null,
  summary text not null,
  dimensions_json text not null default '[]',
  status text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, opportunity_id)
);

create index matches_status_idx on matches (status);

create table checklists (
  id text primary key,
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  title text not null,
  closes_on text,
  created_at timestamptz not null default now(),
  unique (organization_id, opportunity_id)
);

create table checklist_items (
  id text primary key,
  checklist_id text not null references checklists (id),
  position integer not null,
  phase text not null,
  title text not null,
  detail text not null default '',
  source_ref text not null default '',
  due_on text,
  status text not null default 'open',
  evidence text not null default ''
);

create index checklist_items_list_idx on checklist_items (checklist_id, position);

create table projects (
  id text primary key,
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  checklist_id text not null unique references checklists (id),
  name text not null,
  status text not null,
  closes_on text,
  created_at timestamptz not null default now()
);

create index projects_org_idx on projects (organization_id);

create table tasks (
  id text primary key,
  project_id text not null references projects (id),
  checklist_item_id text references checklist_items (id),
  position integer not null,
  phase text not null,
  title text not null,
  detail text not null default '',
  assignee_id text references team_members (id),
  status text not null,
  due_on text,
  work_product text not null default ''
);

create index tasks_project_idx on tasks (project_id, position);

create table task_notes (
  id text primary key,
  task_id text not null references tasks (id),
  author_name text not null,
  author_kind text not null,
  author_side text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index task_notes_task_idx on task_notes (task_id, created_at);

create table proposals (
  id text primary key,
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  project_id text references projects (id),
  title text not null,
  status text not null,
  win_themes text not null default '',
  approach_notes text not null default '',
  constraints text not null default '',
  created_at timestamptz not null default now(),
  unique (organization_id, opportunity_id)
);

create table proposal_versions (
  id text primary key,
  proposal_id text not null references proposals (id),
  version_number integer not null,
  body text not null,
  author_name text not null,
  author_side text not null,
  author_kind text not null,
  change_note text not null default '',
  created_at timestamptz not null default now(),
  unique (proposal_id, version_number)
);

create index proposal_versions_idx on proposal_versions (proposal_id, version_number desc);

create table proposal_notes (
  id text primary key,
  proposal_id text not null references proposals (id),
  author_name text not null,
  author_side text not null,
  author_kind text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index proposal_notes_idx on proposal_notes (proposal_id, created_at);

create table activity (
  id text primary key,
  organization_id text references organizations (id),
  actor_name text not null,
  actor_kind text not null,
  summary text not null,
  href text not null default '',
  created_at timestamptz not null default now()
);

create index activity_created_idx on activity (created_at desc);
