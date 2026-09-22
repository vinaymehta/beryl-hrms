namespace :appraisal do
  # The scope's 2026 performance areas (§5) with their stated weights, mapped
  # onto the three lenses (§15). Idempotent — safe to re-run.
  #
  # A rake task rather than db/seeds.rb because it is per-company and an
  # existing installation will want it applied without touching demo data.
  desc "Create the 2026 appraisal template for a company (COMPANY=slug)"
  task seed_template: :environment do
    slug = ENV.fetch("COMPANY") { abort "COMPANY=<slug> is required" }
    company = Company.find_by!(slug: slug)

    AREAS = [
      [ "Technical Skills & Code Quality", 20, :past ],
      [ "Delivery & Productivity",         20, :past ],
      [ "Ownership & Accountability",      15, :past ],
      [ "AI & Modern Engineering Skills",  15, :future_readiness ],
      [ "Learning & Skill Growth",         10, :current_capability ],
      [ "Communication & Teamwork",        10, :current_capability ],
      [ "Business & Client Impact",        10, :past ]
    ].freeze

    ActsAsTenant.with_tenant(company) do
      if company.appraisal_templates.exists?(name: "2026 Performance Review")
        puts "already present for #{slug} — skipping"
        next
      end

      template = company.appraisal_templates.create!(
        name: "2026 Performance Review",
        description: "Seven weighted performance areas across the past / current / future lenses."
      )

      AREAS.each_with_index do |(name, weight, lens), index|
        category = template.categories.create!(name: name, weight: weight, lens: lens, position: index)
        category.questions.create!(prompt: name, position: 0, requires_comment: false)
      end

      template.update!(status: :active)
      total = template.categories.sum { |c| c.weight }
      puts "created '#{template.name}' v#{template.version} for #{slug} — #{AREAS.size} areas, #{total}% weighted"
    end
  end
end
