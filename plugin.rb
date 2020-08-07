# frozen_string_literal: true

# name: discourse-unikname
# about: Add support for Unikname Connect as a login provider
# version: 1.0
# authors: Unikname
# url: https://github.com/unik-name/discourse-unikname

require_relative "lib/omniauth_open_id_connect"
require_relative "lib/unikname_connect_authenticator"

register_asset 'stylesheets/unikname.scss'

register_svg_icon "power-off" if respond_to?(:register_svg_icon)
register_svg_icon "envelope" if respond_to?(:register_svg_icon)
register_svg_icon "id-badge" if respond_to?(:register_svg_icon)
register_svg_icon "key" if respond_to?(:register_svg_icon)
register_svg_icon "gift" if respond_to?(:register_svg_icon)

auth_provider authenticator: UniknameConnectAuthenticator.new()
