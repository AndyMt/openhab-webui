(function() {
    'use strict';

    angular
        .module('app.widgets')
        .directive('widgetStats', widgetStats)
        .controller('WidgetSettingsCtrl-stats', WidgetSettingsCtrlStats)
        .config(function (WidgetsProvider) { 
            WidgetsProvider.$get().registerType({
                type: 'stats',
                displayName: 'Statistics',
                icon: 'stats',
                description: 'Displays a bar chart'
            });
        });

    widgetStats.$inject = ['$rootScope', '$timeout', '$uibModal', 'OHService'];

    var Width = 0;
    function widgetStats($rootScope, $timeout, $modal, OHService) {
        // Usage: <widget-stats ng-model="widget" />
        //
        // Creates: A stats widget
        //
        var directive = {
            bindToController: true,
            controller: StatsController,
            controllerAs: 'vm',
            link: link,
            restrict: 'AE',
            templateUrl: 'app/widgets/stats/stats.tpl.html',
            scope: {
                ngModel: '='
            }
        };
        return directive;
        
        function link(scope, element, attrs) {
            $timeout(function () {
                var width = element[0].parentNode.parentNode.parentNode.style.width.replace('px', '');
                var height = element[0].parentNode.parentNode.parentNode.style.height.replace('px', '');
                Width = width;
            });
        }
    }
    StatsController.$inject = ['$rootScope', '$scope', '$timeout', '$http', '$q', '$filter', 'OHService', 'themeValueFilter'];
    function StatsController ($rootScope, $scope, $timeout, $http, $q, $filter, OHService, themeValueFilter) {
        var vm = this;
        this.widget = this.ngModel;

        function formatValue(itemname, val) {
            var item = OHService.getItem(itemname);
            if (!item) 
                return "-";
            if (item && item.stateDescription && item.stateDescription.pattern) {
                if (item.type.indexOf('Number:') === 0 && item.state.indexOf(' ') > 0) {
                    var format = item.stateDescription.pattern.replace('%unit%', item.state.split(' ')[1].replace('%', '%%'));
                    return sprintf(format, val);
                } else {
                    return sprintf(item.stateDescription.pattern, val);
                }
            } else {
                if (item.type.indexOf('Number:') === 0 && item.state.indexOf(' ') > 0) {
                    return val + ' ' + item.state.split(' ')[1];
                } else {
                    return val;
                }
            }
        }

        function tooltipHook(values) {
            if (values)
                return {
                    abscissas: $filter('date')(values[0].row.x, 'EEE') + ' ' + $filter('date')(values[0].row.x, 'dd.MM.yy HH:mm'),
                    rows: values.map(function(val) {
                        return {
                            label: val.series.label,
                            value: formatValue(val.series.id, val.row.y0 || val.row.y1),
                            color: val.series.color,
                            id: val.series.id
                        }
                    })
                };
        };

        {
            var endDate = new Date();
            
            var startTime = function() {
            	var startDate = new Date();
                switch (vm.widget.period)
                {
                    case 'W':  endDate.setTime(endDate.setHours(0,0,0,0)); startDate.setTime(endDate.getTime() - 7.5*24*60*60*1000); break;
                    case '2W': endDate.setTime(endDate.setHours(0,0,0,0)); startDate.setTime(endDate.getTime() - 2*7.25*24*60*60*1000); break;
                    case 'M': endDate.setTime(endDate.setHours(0,0,0,0)); startDate.setMonth(endDate.getMonth() - 1); break;
                    case '2M': endDate.setTime(endDate.setHours(0,0,0,0)); startDate.setMonth(endDate.getMonth() - 2); break;
                    case '3M': endDate.setTime(endDate.setHours(0,0,0,0)); startDate.setMonth(endDate.getMonth() - 3); break;
                    case '4M': endDate.setTime(endDate.setHours(0,0,0,0)); startDate.setMonth(endDate.getMonth() - 4); break;
                    case '6M': endDate.setTime(endDate.setHours(0,0,0,0)); startDate.setMonth(endDate.getMonth() - 6); break;
                    case 'Y': endDate.setTime(endDate.setHours(0,0,0,0)); startDate.setFullYear(endDate.getFullYear() - 1); break;
                    default: startDate.setTime(endDate.getTime() - 24*60*60*1000); break;
                }
                return startDate;
            }
            var startDate = startTime();

            if (!vm.widget.series || !vm.widget.series.length)
                return;

            var getData = function () {

                var hasInterval = vm.widget.axis.x && vm.widget.axis.x.interval;
                vm.rawdata = [];
                for (var i = 0; i < vm.widget.series.length; i++) {
                    var hasColumns = vm.widget.series[i].display_columns;
                    vm.rawdata[i] = $http.get('/rest/persistence/items/' + vm.widget.series[i].item + "?"
                        + (hasColumns ? "boundary=false" : "boundary=true") 
                        + "&starttime=" + startDate.toISOString() 
                        + "&endtime=" + endDate.toISOString() 
                        + (vm.widget.service ? '&serviceId=' + vm.widget.service : ''));
                }

                $q.all(vm.rawdata).then(function (values) {
      				//console.log(values);
                    vm.datasets = {};
                    for (var i = 0; i < values.length; i++) {
	                    var seriesname = values[i].data.name;

                        var finaldata = [];
                        if (vm.widget.series[i].display_columns)
                        {
                            finaldata = values[i].data.data;

                            angular.forEach(finaldata, function (datapoint) {
                                datapoint.state = datapoint.state.replace("ON",1);
                                datapoint.state = datapoint.state.replace("OFF",0);
                                datapoint.time = new Date(datapoint.time);
                                datapoint.state = parseFloat(datapoint.state);
                            });
                            var endPoint = {
                                state: null,
                                time: endDate
                            }
                            finaldata.push(endPoint);
                        }
                        else
                        {
                            var gridFactor = hasInterval ? vm.widget.axis.x.interval * 60 * 1000 : 60 * 1000;
                            var startDate = startTime();
                            var prevTime = startTime();
                            var prevValue = 0.0;
                            var prevIndex = 0;
                            angular.forEach(values[i].data.data, function (datapoint, index) 
                            {
                                datapoint.time = new Date(datapoint.time);
                                // align timestamps
                                if (index > 0 && hasInterval)
                                {
                                    datapoint.time.setTime( Math.floor(datapoint.time.getTime() / gridFactor) * gridFactor);
                                }
                                if (prevTime != datapoint.time.getTime() || index == 0)
                                {
                                    prevIndex = finaldata.length;
                                    datapoint.state.replace("ON",1);
                                    datapoint.state.replace("OFF",0);
                                    datapoint.state = parseFloat(datapoint.state);

                                    // was there a value missing?
                                    var distance = datapoint.time.getTime() - prevTime;
                                    while (hasInterval && distance > gridFactor && index > 0)
                                    {
                                        var newValue = parseFloat(datapoint.state);
                                        var diff = newValue - prevValue;
                                        var insertValue = prevValue + diff / parseFloat(distance / gridFactor);
                                        var insertpoint = {
                                            time: new Date(prevTime+gridFactor),
                                            state: insertValue                                        
                                        };
                                        finaldata.push(insertpoint)
                                        prevTime = insertpoint.time.getTime()
                                        prevValue = insertValue;
                                        distance = datapoint.time.getTime() - prevTime;
                                    }

                                    finaldata.push(datapoint)
                                    prevTime = datapoint.time.getTime()
                                    prevValue = parseFloat(datapoint.state);
                                }
                                else if (prevIndex > 0)
                                {
                                    finaldata[prevIndex].state = (parseFloat(datapoint.state) + prevValue) / 2.0
                                }                        
                            });
                            // interpolate last datapoint if missing
                            var item = OHService.getItem(values[i].data.name);
                            if (item)
                            {
                                var insertpoint = {
                                    state: parseFloat(item.state),
                                    time: new Date()
                                }
                                finaldata.push(insertpoint)
                            }
                            //console.log(finaldata);
                        }
                        vm.datasets[seriesname] = finaldata;
                    }

                    var tickCount = Width < 400 ? 6 : 12;

                    vm.interactiveChartOptions = {
                        margin: {
                            top: 20,
                            bottom: 50
                        },
                        series: [],
                        axes: {
                            x: {
                                key: "time",
                                type: "date",
                                ticks: tickCount,
                                tickFormat: function (value) {
                                    if (vm.widget.period === 'W')
                                    {
                                        return value.getHours() === 0 ? "": $filter('date')(value, 'EEE d');
                                    }
                                    else if (vm.widget.period === '2W')
                                    {
                                        return value.getHours() === 0 ? "            "+$filter('date')(value, 'EEE d') : "";
                                    }
                                    else if (value.getHours() === 0) 
                                    {
                                        if (value.getDate() === 1 || vm.widget.period === '2M' || vm.widget.period === '4M') {
                                            return $filter('date')(value, 'd MMM');
                                        }
                                        return $filter('date')(value, 'EEE d');
                                    }
                                    return $filter('date')(value, 'HH:mm');
                                }
                            },
                            y: { padding: { min: 0, max: 8 } }
                        },
                        tooltipHook: tooltipHook,
                        zoom: {
                            x: true
                        },
                    };

                    if (vm.widget.axis.y.min)
                        vm.interactiveChartOptions.axes.y.min = vm.widget.axis.y.min;
                    if (vm.widget.axis.y.max)
                        vm.interactiveChartOptions.axes.y.max = vm.widget.axis.y.max;
                    if (vm.widget.axis.y.includezero)
                        vm.interactiveChartOptions.axes.y.includeZero = vm.widget.axis.y.includezero;
                    if (vm.widget.axis.y.ticks)
                        vm.interactiveChartOptions.axes.y.ticks = vm.widget.axis.y.ticks;
                    if (vm.widget.axis.y2 && vm.widget.axis.y2.enabled) {
                        vm.interactiveChartOptions.axes.y2 = { padding: { min: 0, max: 8 } };
                        if (vm.widget.axis.y2.min)
                            vm.interactiveChartOptions.axes.y2.min = vm.widget.axis.y2.min;
                        if (vm.widget.axis.y2.max)
                            vm.interactiveChartOptions.axes.y2.max = vm.widget.axis.y2.max;
                        if (vm.widget.axis.y2.includezero)
                            vm.interactiveChartOptions.axes.y2.includeZero = vm.widget.axis.y2.includezero;
                        if (vm.widget.axis.y2.ticks)
                            vm.interactiveChartOptions.axes.y2.ticks = vm.widget.axis.y2.ticks;
                    }

                    for (var i = 0; i < vm.widget.series.length; i++) {
                        var seriesoptions = {
                            axis: vm.widget.series[i].axis,
                            dataset: vm.widget.series[i].item,
                            key: "state",
                            label: vm.widget.series[i].name || vm.widget.series[i].item,
                            color: themeValueFilter(vm.widget.series[i].color, 'primary-color'),
                            type: [],
                            id: vm.widget.series[i].item
                        };
                        if (vm.widget.series[i].display_line) seriesoptions.type.push("line");
                        if (vm.widget.series[i].display_thin) seriesoptions.type.push("dashed-line");
                        if (vm.widget.series[i].display_area) seriesoptions.type.push("area");
                        if (vm.widget.series[i].display_dots) seriesoptions.type.push("dot");
                        if (vm.widget.series[i].display_columns) seriesoptions.type.push("column");
                        if (vm.widget.series[i].smooth) seriesoptions.interpolation = { mode: "monotone"};

                        vm.interactiveChartOptions.series.push(seriesoptions);
                    }

                    vm.interactiveChartReady = true;
                });
                vm.interactiveChartReady = true;
            };

            OHService.onUpdate($scope, vm.widget.item, function (value, item) {
                if (!vm.interactiveChartReady) {
                    $timeout(function () {
                        getData();
                    })
                }
            });
        }

    }


    // settings dialog
    WidgetSettingsCtrlStats.$inject = ['$scope', '$timeout', '$rootScope', '$uibModalInstance', 'widget', 'OHService'];

    function WidgetSettingsCtrlStats($scope, $timeout, $rootScope, $modalInstance, widget, OHService) {
        $scope.widget = widget;
        $scope.items = OHService.getItems();

        $scope.form = {
            name: widget.name,
            sizeX: widget.sizeX,
            sizeY: widget.sizeY,
            col: widget.col,
            row: widget.row,
            item: widget.item,
            service: widget.service,
            period: widget.period,
            showlegend: widget.showlegend,
            refresh: widget.refresh,
            axis: widget.axis || {y: {}, y2: {} },
            series: widget.series || []
        };
        if (!$scope.form.axis.y2)
            $scope.form.axis.y2 = { enabled: false };
        
        $scope.accordions = [];

        $scope.dismiss = function() {
            $modalInstance.dismiss();
        };

        $scope.addSeries = function () {
            $scope.form.series.push({ axis: 'y', display_line: true, display_area: true });
            $scope.accordions[$scope.form.series.length - 1] = true;
        };

        function array_move(arr, old_index, new_index) {
            if (new_index < 0 )
                return new_index;
            if (new_index >= arr.length) 
                return new_index;

            arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
            return new_index;
        };

        $scope.removeSeries = function (series) {
            if(confirm("Delete ["+series.label + "]?")) {
                $scope.form.series.splice($scope.form.series.indexOf(series), 1);                
            }
        }

        $scope.moveUpSeries = function (series) {
            var index = $scope.form.series.indexOf(series);
            $scope.accordions[index] = false;
            index = array_move($scope.form.series, index, index-1);
            $scope.accordions[index] = true;
        }

        $scope.moveDnSeries = function (series) {
            var index = $scope.form.series.indexOf(series);
            $scope.accordions[index] = false;
            index = array_move($scope.form.series, index, index+1);
            $scope.accordions[index] = true;
        }

        $scope.remove = function() {
            $scope.dashboard.widgets.splice($scope.dashboard.widgets.indexOf(widget), 1);
            $modalInstance.close();
        };

        $scope.submit = function() {
            angular.extend(widget, $scope.form);
            if (!widget.axis.y2.enabled)
                delete widget.axis.y2;
            delete widget.showlegend;

            $modalInstance.close(widget);
        };

    }


})();
