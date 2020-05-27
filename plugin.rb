# frozen_string_literal: true

# name: discourse-unikname-connect
# about: Add support for Unikname Connect as a login provider
# version: 1.0
# authors: Unikname
# url: https://github.com/unik-name/discourse-unikname-connect

require_relative "lib/omniauth_open_id_connect"
require_relative "lib/openid_connect_authenticator"

auth_provider authenticator: OpenIDConnectAuthenticator.new()
