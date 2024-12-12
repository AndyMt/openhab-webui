(function() {
    'use strict';

    angular
        .module('app.widgets')
        .directive('widgetEdit', widgetEdit)
        .controller('EditPadController', EditPadController)
        .controller('WidgetSettingsCtrl-edit', WidgetSettingsCtrlEdit)
        .config(function (WidgetsProvider) {
            WidgetsProvider.$get().registerType({
                type: 'edit',
                displayName: 'Edit',
                icon: 'th',
                description: 'A widget allowing to edit the value of an item'
            });
        });

    widgetEdit.$inject = ['$rootScope', '$uibModal', 'OHService'];
    function widgetEdit($rootScope, $modal, OHService) {
        // Usage: <widget-edit ng-model="widget" />
        //
        // Creates: An Edit widget
        //
        var directive = {
            bindToController: true,
            controller: EditController,
            controllerAs: 'vm',
            link: link,
            restrict: 'AE',
            templateUrl: 'app/widgets/edit/edit.tpl.html',
            scope: {
                ngModel: '='
            }
        };
        return directive;

        function link(scope, element, attrs) {
            element[0].parentElement.parentElement.className += " activefeedback";
        }
    }
    EditController.$inject = ['$rootScope', '$scope', '$filter', '$uibModal', 'OHService'];
    function EditController ($rootScope, $scope, $filter, $uibModal, OHService) {
        var vm = this;
        this.widget = this.ngModel;

        function updateValue() {
            vm.item = OHService.getItem(vm.widget.item);
            if (!vm.item || vm.item.state === vm.value) return;
            vm.value = vm.item.transformedState || vm.item.state;
            vm.state = vm.item.state;

            if (!vm.choices) {
                switch (vm.widget.choices_source) {
                    case 'server':
                        vm.choices = vm.item.commandDescription.commandOptions.map(function (option) {
                            return { cmd: option.command, label: option.label };
                        });
                        break;
                    case 'csv':
                        vm.choices = vm.widget.choices.split(',').map(function (choice) {
                            choice = choice.split('=');
                            if (choice.length === 2) {
                                return { cmd: choice[0], label: choice[1] };
                            } else {
                                return { cmd: choice[0], label: choice[0] };
                            }
                        });
                        break;
                    default:
                        vm.choices = vm.widget.choices;
                }
            }

            function filterChoice(choice, i, choices) {
                if (choice.cmd === vm.state) return true;
                return false;
            }
            if ($filter('filter')(vm.choices, filterChoice, true).length > 0) {
                vm.currentChoice = $filter('filter')(vm.choices, filterChoice, true)[0];
                if (vm.currentChoice.label)
                    vm.value = vm.currentChoice.label;
            }
        }

        OHService.onUpdate($scope, vm.widget.item, function () {
            updateValue();
        });

        vm.openChoices = function () {
            vm.modalInstance = $uibModal.open({
                animation: false,
                templateUrl: 'editWindow.html',
                controller: 'EditPadController',
                controllerAs: 'vm',
                size: 'lg',
                resolve: {
                    choices: function () { return vm.choices; },
                    widget: function () { return vm.widget; },
                    item: function () { return vm.item; }
                }
            });
        };

        $scope.$on('$destroy', function () {
            if (vm.modalInstance) {
                vm.modalInstance.dismiss();
            }
        });


    }

    EditPadController.$inject = ['$scope', '$uibModalInstance', 'choices', 'widget', 'item', 'OHService'];
    function EditPadController($scope, $uibModalInstance, choices, widget, item, OHService) {
        var vm = this;
        vm.choices = choices;
        vm.item = item;
        vm.no_highlight = widget.no_highlight;
        vm.columns = 3;
        vm.mobile_mode = !widget.disable_mobile;
        vm.square = vm.columns > 1 && !widget.no_squares;

        //vm.gridClassMode = (vm.mobile_mode) ? 'sm' : 'xs';
        //vm.gridClass = 'col-' + vm.gridClassMode + '-' + (vm.columns == 5 ? '5ths' : (12 / vm.columns).toString());
        vm.gridClassMode = 'xs';
        vm.gridClass = 'col-' + vm.gridClassMode + '-' + '4';

        vm.selectChoice = function (choice) {
            OHService.sendCmd(widget.item, choice.cmd);
            if (!widget.keep_open) {
                $uibModalInstance.close(choice);
            }
        };

        vm.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
    }

    // settings dialog
    WidgetSettingsCtrlEdit.$inject = ['$scope', '$timeout', '$rootScope', '$uibModalInstance', 'widget', 'OHService'];

    function WidgetSettingsCtrlEdit($scope, $timeout, $rootScope, $modalInstance, widget, OHService) {
        $scope.widget = widget;
        $scope.items = OHService.getItems();

        $scope.form = {
            name            : widget.name,
            sizeX           : widget.sizeX,
            sizeY           : widget.sizeY,
            col             : widget.col,
            row             : widget.row,
            item            : widget.item,
            hidelabel       : widget.hidelabel,
            hideicon        : widget.hideicon,
            hidestate       : widget.hidestate,
            nolinebreak     : widget.nolinebreak,
            font_size       : widget.font_size,
            backdrop_iconset: widget.backdrop_iconset,
            backdrop_icon   : widget.backdrop_icon,
            backdrop_center : widget.backdrop_center,
            iconset         : widget.iconset,
            icon            : widget.icon,
            icon_size       : widget.icon_size,
            icon_nolinebreak: widget.icon_nolinebreak,
            disable_mobile  : widget.disable_mobile,
            no_squares      : widget.no_squares,
            choices_columns : widget.choices_columns || 3,
            choices_source  : widget.choices_source,
            choices         : widget.choices,
            keep_open       : widget.keep_open,
            no_highlight    : widget.no_highlight
        };

        $scope.dismiss = function() {
            $modalInstance.dismiss();
        };

        $scope.remove = function() {
            $scope.dashboard.widgets.splice($scope.dashboard.widgets.indexOf(widget), 1);
            $modalInstance.close();
        };

        $scope.submit = function() {
            angular.extend(widget, $scope.form);
            $modalInstance.close(widget);
        };
    }
})();
