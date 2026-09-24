module Api
  module V1
    module Auth
      class MeController < Api::V1::BaseController
        # Reachable while a forced password change is outstanding: this is how
        # the frontend finds out it has to show the change screen.
        allow_pending_password_change

        def show
          render_data(::Auth::MePresenter.call(Current.user))
        end
      end
    end
  end
end
