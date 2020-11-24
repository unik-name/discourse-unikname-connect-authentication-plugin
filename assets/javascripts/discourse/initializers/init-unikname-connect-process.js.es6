import { withPluginApi } from "discourse/lib/plugin-api";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import { findAll } from "discourse/models/login-method";

function initializeBetterAuthUX(api) {
  api.modifyClass("controller:create-account", {
    submitDisabled: true,
    steps: {
      accountUsernameStep: {
        id: "accountUsernameStep",
        prev: false,
        next: (that) =>  {
          if (that.fullnameRequired) {
            return "accountFullNameStep";
          }
          return "accountEmailStep";
        },
        canGoNextStep: (that) => {
          return !!that.get("usernameValidation.ok");
        }
      },
      accountFullNameStep: {
        id: "accountFullNameStep",
        prev: (that) => "accountUsernameStep",
        next: (that) => "accountEmailStep",
        canGoNextStep: (that) => true,
      },
      accountEmailStep: {
        id: "accountEmailStep",
        prev: (that) => {
          if (that.fullnameRequired) {
            return "accountFullNameStep";
          }
          return "accountUsernameStep";
        },
        next: (that) => {
          if (that.passwordRequired) {
            return "accountPasswordStep";
          }
          if (that.requireInviteCode) {
            return "accountInvitationCodeStep";
          }
          if (that.userFields) {
            return "accountAdditionalInformationsStep";
          }
          return "finalStep"
        },
        isLastStep: (that) => {
          return !that.passwordRequired && !that.requireInviteCode && that.userFields.length === 0;
        },
        canGoNextStep: (that) => {
          return that.get("emailValidation.ok");
        }
      },
      accountPasswordStep: {
        id: "accountPasswordStep",
        prev: (that) => "accountEmailStep",
        next: (that) => {
          if (that.requireInviteCode) {
            return "accountInvitationCodeStep"
          }
          if (that.userFields) {
            return "accountAdditionalInformationsStep";
          }
          return "finalStep";
        },
        isLastStep: (that) => {
          return !that.requireInviteCode && that.userFields.length === 0;
        },
        canGoNextStep: (that) => {
          return that.passwordRequired ? !!that.get("passwordValidation.ok") : true;
        }
      },
      accountInvitationCodeStep: {
        id: "accountInvitationCodeStep",
        prev: (that) => {
          if (that.passwordRequired) {
            return "accountPasswordStep";
          }
          if (that.userFields) {
            return "accountAdditionalInformationsStep";
          }
          return "accountEmailStep";
        },
        isLastStep: (that) => {
          return !that.userFields;
        },
        next: (that) => "finalStep",
        canGoNextStep: (that) => {
          return that.requireInviteCode ? that.inviteCode : true;
        }
      },
      accountAdditionalInformationsStep: {
        id: "accountAdditionalInformationsStep",
        prev: (that) => {
          if (that.passwordRequired) {
            return "accountPasswordStep";
          }
          return "accountEmailStep";
        },
        isLastStep: (that) => true,

      },
      finalStep: {
        prev: "accountEmailStep"
      }
    },
    emailBackup: "",
    error: "",
    activeStep: "accountUsernameStep",
    actions: {
      next() {
        this.moveStep(true);
      },
      prev() {
        this.moveStep(false);
      },
      switchToMail() {
        $(".d-modal.create-account .login-form, .d-modal.create-account .modal-footer").css("display", "block");
        $(".login-buttons-with-email").css("display", "none");
        $(".login-link-container").css("display", "none");
      },
      createAccount() {
        // To redirect to email update page
        if (this.isUniknameAuth) {
          this.set("authOptions.destination_url", "/my/preferences/email")
        }
        this._super();
      },
    },
    moveStep(isNext) {
      if (isNext ? this.steps[this.activeStep].canGoNextStep && this.steps[this.activeStep].canGoNextStep(this) : this.steps[this.activeStep].prev) {
        $(`#${this.activeStep}`).css("display", "none");
        if (!isNext) {
          $(`#${this.activeStep}Indicator`).removeClass("active");
        }
        this.set("activeStep", this.steps[this.activeStep][isNext ? "next" : "prev"](this));
        if (isNext) {
          $(`#${this.activeStep}Indicator`).addClass("active");
        }
        $(`#${this.activeStep}`).css("display", "flex");
      }

      this.updateActionButtons(isNext);
    },
    updateActionButtons(isNext) {
      // update buttons
      var displayBackButton = this.activeStep !== this.steps.accountUsernameStep.id;
      $(".back-btn").css("display", displayBackButton ? "block" : "none");

      var disableNextButton = isNext ? !this.steps[this.activeStep].canGoNextStep(this) : false
      $(".next-btn").prop("disabled", disableNextButton);
    },
    isLastStep() {
      return this.steps[this.activeStep].isLastStep && this.steps[this.activeStep].isLastStep(this);
    },
    @discourseComputed("hasAuthOptions", "canCreateLocal", "skipConfirmation")
    showCreateForm(hasAuthOptions, canCreateLocal, skipConfirmation) {
      return (hasAuthOptions || canCreateLocal) && !skipConfirmation && hasAuthOptions;
    },
    @discourseComputed("hasAuthOptions")
    showOncreateAfterLogin(hasAuthOptions) {
      return hasAuthOptions ? 'forceDisplay' : '';
    },
    @discourseComputed("hasAuthOptions")
    emailProcess(hasAuthOptions) {
      return !hasAuthOptions;
    },
    @discourseComputed("hasAuthOptions")
    isUniknameAuth(hasAuthOptions) {
      return hasAuthOptions && this.get("authOptions.auth_provider") === "unikname";
    },
    @observes("usernameValidation", "passwordValidation")
    changeNextButtonState: function() {
      $(".next-btn").prop("disabled", !this.steps[this.activeStep].canGoNextStep(this));
    },
    @observes("activeStep")
    showHideSubmitButtonState: function() {
      var displaySubmitButton = this.isLastStep();

      var submitButton = $(".submit-btn");
      submitButton.css("display", displaySubmitButton ? "block" : "none").prop("disabled", true);
      var nextButtun = $(".next-btn");
      nextButtun.css("display", displaySubmitButton ? "none" : "block");

      if (this.isLastStep()) {
        var activateSubmitButton = !!this.get("usernameValidation.ok");
        submitButton.prop("disabled", !activateSubmitButton);
      }
    },
    @observes("accountEmail")
    changeEmailNextButtonState: function() {
      if (this.activeStep === this.steps.accountEmailStep.id && !this.isLastStep()) {
        var activateNextBtn = !!this.get("emailValidation.ok");
        $(".next-btn").prop("disabled", !activateNextBtn);
      }
    },
    @observes("accountUsername")
    changeUserName: function() {
      if (this.isUniknameAuth && this.accountUsername && this.accountUsername.startsWith("Change-Me_Unikname-")) {
        this.accountUsername = "";
        if (this.fullnameRequired) {
          this.accountName = "";
        }
      }
    }
  });

  api.modifyClass("controller:login", {
    @discourseComputed("loggingIn", "application.canSignUp")
    showSignupLink(loggingIn, canSignUp) {
      return canSignUp;
    },
    actions: {
      switchToMail() {
        $(".d-modal.login-modal .login-modal #login-form").css("display", "block");
        $(".d-modal.login-modal .login-modal .login-email").css("display", "none");
        $(".d-modal.login-modal .login-modal #login-buttons").css("display", "none");
      }
    },
  });

}

function initializeUnikname(api) {

  const OIDC_NAME = "unikname";

  api.modifyClass("component:login-buttons", {
    @discourseComputed
    buttons() {
      return findAll()
      .map(button => {
        button.set("isUnikname", button.name === OIDC_NAME);
        return button;
      })
      .sort((a, b) => {
        // Put Unikname on top
        return a.isUnikname ? -1 : 1;
      });
    },
    @discourseComputed("buttons")
    showSeparator(buttons) {
      return buttons.length > 1;
    }
  });
}

export default {
  name: "init-unikname-connect-process",

  initialize(container) {
    const siteSettings = container.lookup("site-settings:main");

    // Better Auth UX init
    withPluginApi("0.8.8", initializeBetterAuthUX);

    // Unikname init
    if (siteSettings.unikname_connect_enabled) {
      withPluginApi("0.8.8", initializeUnikname);
    }
  }
};
