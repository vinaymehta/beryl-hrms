module Api
  module V1
    module Auth
      class MeController < Api::V1::BaseController
        def show
          render_data(::Auth::MePresenter.call(Current.user))
        end
      end
    end
  end
end
