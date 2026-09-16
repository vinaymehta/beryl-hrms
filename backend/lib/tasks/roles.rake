namespace :roles do
  # Roles::SeedDefaults runs exactly once, when a company registers. Anything
  # later added to DEFAULT_ROLE_PERMISSIONS therefore reaches new companies
  # only — every company that already existed keeps the permission set it was
  # created with, and the new feature silently does nothing for them.
  #
  # This tops those roles up. Deliberately a task you invoke rather than
  # something that runs on boot or on migrate: it writes to every tenant at
  # once, and that should be a decision, not a side effect.
  #
  #   bin/rails roles:sync_defaults           # report only
  #   bin/rails roles:sync_defaults APPLY=1   # actually grant
  desc "Grant system_default roles any permissions missing from Roles::SeedDefaults (DRY RUN unless APPLY=1)"
  task sync_defaults: :environment do
    apply = ENV["APPLY"].present?
    puts(apply ? "Applying missing default permissions…" : "DRY RUN — re-run with APPLY=1 to write.")

    granted = 0

    ActsAsTenant.without_tenant do
      # Only the four seeded roles. A role someone built themselves is theirs,
      # and its permission set is not ours to have opinions about.
      Role.where(system_default: true).find_each do |role|
        wanted = Roles::SeedDefaults::DEFAULT_ROLE_PERMISSIONS[role.slug]
        next if wanted.blank?

        # :all means "whatever the catalog holds", so an admin role picks up
        # newly catalogued permissions too.
        keys = wanted == :all ? Permissions::Catalog::LIST : wanted
        missing = Permission.where(key: keys).where.not(id: role.permissions.select(:id))
        next if missing.empty?

        puts "  #{role.company.name} / #{role.slug}: #{missing.pluck(:key).sort.join(', ')}"
        granted += missing.count

        # Additive only. A permission an admin deliberately revoked would be
        # restored by this, which is the cost of the task being able to fix
        # anything at all — hence the dry run being the default.
        ActsAsTenant.with_tenant(role.company) { role.permissions += missing.to_a } if apply
      end
    end

    puts granted.zero? ? "Nothing missing." : "#{apply ? 'Granted' : 'Would grant'} #{granted} permission(s)."
  end
end
