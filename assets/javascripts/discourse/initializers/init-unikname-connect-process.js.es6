import { withPluginApi } from "discourse/lib/plugin-api";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import { findAll } from "discourse/models/login-method";

function initializeBetterAuthUX(api) {

  api.modifyClass("controller:create-account", {
    steps: {
      presentationStep: {
        id: "presentationStep",
        prev: (that) => false,
        next: (that) => "accountUsernameStep",
        canGoNextStep: (that) => {
          return true;
        }
      },
      accountUsernameStep: {
        id: "accountUsernameStep",
        prev: (that) => "presentationStep",
        next: (that) =>  {
          if (that.fullnameRequired) {
            return "accountFullNameStep";
          }
          return "accountEmailStep";
        },
        disableNextFirst: true,
        canGoNextStep: (that) => {
          return !!that.get("usernameValidation.ok");
        }
      },
      accountFullNameStep: {
        id: "accountFullNameStep",
        prev: (that) => "accountUsernameStep",
        next: (that) => "accountEmailStep",
        canGoNextStep: (that) => true
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
          return "accountPasswordStep"
        },
        isLastStep: (that) => !that.requireInviteCode && !that.passwordRequired,
        canGoNextStep: (that) => {
          return that.bypassEmail || that.get("emailValidation.ok");
        }
      },
      accountPasswordStep: {
        id: "accountPasswordStep",
        prev: (that) => "accountEmailStep",
        next: (that) => {
          if (that.requireInviteCode) {
            return "accountInvitationCodeStep"
          }
          return "finalStep";
        },
        isLastStep: (that) => !that.requireInviteCode,
        disableNextFirst: true,
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
          return "accountEmailStep";
        },
        next: (that) => "finalStep",
        isLastStep: (that) => true,
        disableNextFirst: true,
        canGoNextStep: (that) => {
          return that.requireInviteCode ? that.inviteCode : true;
        }
      },
      finalStep: {
        prev: "accountEmailStep"
      }
    },
    bypassEmail: false,
    emailBackup: "",
    error: "",
    activeStep: "presentationStep",
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
      }
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
      var displayBackButton = this.activeStep !== this.steps.presentationStep.id;
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
    // @discourseComputed("authOptions.auth_provider")
    // showBypassEmail() {
    //   return this.get("authOptions.auth_provider") === OIDC_NAME;
    // },
    @observes("usernameValidation")
    changeNextButtonState: function() {
      $(".next-btn").prop("disabled", !this.get("usernameValidation.ok"));
    },
    @observes("activeStep")
    showHideSubmitButtonState: function() {
      var displaySubmitButton = this.isLastStep();

      var submitButton = $(".submit-btn");
      submitButton.css("display", displaySubmitButton ? "block" : "none").prop("disabled", true);
      var nextButtun = $(".next-btn");
      nextButtun.css("display", displaySubmitButton ? "none" : "block");

      if (this.activeStep === this.steps.accountUsernameStep.id && !this.accountUsername) {
        nextButtun.prop("disabled", true);
      }
    },
    // @observes("bypassEmail")
    // resetEmailField() {
    //   var emailInput = $("#new-account-email");
    //   emailInput.prop("disabled", this.bypassEmail);
    //   if (this.bypassEmail) {
    //     this.emailBackup = this.accountEmail;
    //     this.emailValidationBackup = this.get("emailValidation.failed");
    //     this.set("emailValidation.failed", false);
    //     this.set("emailValidation.message", "");
    //     this.accountEmail = "";
    //   } else {
    //     this.set("emailValidation.failed", this.emailValidationBackup);
    //     this.emailValidationBackup = null;
    //     this.accountEmail = this.emailBackup;
    //     this.emailBackup = "";
    //   }
    //   emailInput.val(this.accountEmail);
    // },
    @observes("accountEmail", "bypassEmail")
    changeEmailNextButtonState: function() {
      if (this.activeStep === this.steps.accountEmailStep.id && !this.isLastStep()) {
        var activateNextBtn = this.bypassEmail || !!this.get("emailValidation.ok");
        $(".next-btn").prop("disabled", !activateNextBtn);
      }
    },
    @observes("accountEmail", "accountPassword", "bypassEmail", "inviteCode")
    changeSubmitButtonState: function() {
      if (this.isLastStep()) {
        var activateSubmitButton = false;
        if (this.activeStep === this.steps.accountEmailStep.id) {
          activateSubmitButton = this.bypassEmail || this.get("emailValidation.ok");
        } else {
          activateSubmitButton = this.get("passwordValidation.ok") && (this.requireInviteCode ? this.inviteCode : true);
        }
        $(".submit-btn").prop("disabled", !activateSubmitButton);
      }
    }

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
    if (siteSettings.unikname_enabled) {
      withPluginApi("0.8.8", initializeUnikname);
    }
  }
};
