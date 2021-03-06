/*!
 * angular-advanced-searchbox
 * https://github.com/dnauck/angular-advanced-searchbox
 * Copyright (c) 2015 Nauck IT KG http://www.nauck-it.de/
 * Author: Daniel Nauck <d.nauck(at)nauck-it.de>
 * License: MIT
 */

(function() {

'use strict';

angular.module('angular-advanced-searchbox', [])
    .directive('nitAdvancedSearchbox', function() {
        return {
            restrict: 'E',
            scope: {
                model: '=ngModel',
                parameters: '='
            },
            replace: true,
            templateUrl: 'angular-advanced-searchbox.html',
            controller: [
                '$scope', '$attrs', '$element', '$timeout', '$filter',
                function ($scope, $attrs, $element, $timeout, $filter) {

                    $scope.placeholder = $attrs.placeholder || 'Search ...';
                    $scope.searchParams = [];
                    $scope.searchQuery = '';
                    $scope.setSearchFocus = false;
                    var searchThrottleTimer;
                    var changeBuffer = [];

                    $scope.$watch('model', function (newValue, oldValue) {

                        if(angular.equals(newValue, oldValue))
                            return;

                        angular.forEach($scope.model, function (value, key) {
                            if (key === 'query' && $scope.searchQuery !== value) {
                                $scope.searchQuery = value;
                            } else {
                                var paramTemplate = $filter('filter')($scope.parameters, function (param) { return param.key === key; })[0];
                                var searchParam = $filter('filter')($scope.searchParams, function (param) { return param.key === key; })[0];

                                if (paramTemplate !== undefined) {
                                    if(searchParam === undefined)
                                        $scope.addSearchParam(paramTemplate, value, false);
                                    else if (searchParam.value !== value )
                                        searchParam.value = value;
                                }
                            }
                        });

                        // delete not existing search parameters from internal state array
                        angular.forEach($scope.searchParams, function (value, key){
                            if (!$scope.model.hasOwnProperty(value.key))
                                updateModel('delete', value.key);
                        });
                    }, true);

                    $scope.searchParamValueChanged = function (param) {
                        updateModel('change', param.key, param.value);
                    };

                    $scope.searchQueryChanged = function (query) {
                        updateModel('change', 'query', query);
                    };

                    $scope.enterEditMode = function(index) {
                        if (index === undefined)
                            return;

                        var searchParam = $scope.searchParams[index];
                        searchParam.editMode = true;
                    };

                    $scope.leaveEditMode = function(index) {
                        if (index === undefined)
                            return;

                        var searchParam = $scope.searchParams[index];
                        searchParam.editMode = false;

                        // remove empty search params
                        if (!searchParam.value)
                            $scope.removeSearchParam(index);
                    };

                    $scope.typeaheadOnSelect = function (item, model, label) {
                        $scope.addSearchParam(item);
                        $scope.searchQuery = '';
                        updateModel('delete', 'query');
                    };

                    $scope.isUnsedParameter = function (value, index) {
                        return $filter('filter')($scope.searchParams, function (param) { return param.key === value.key; }).length === 0;
                    };

                    $scope.addSearchParam = function (searchParam, value, enterEditModel) {
                        if (enterEditModel === undefined)
                            enterEditModel = true;

                        if (!$scope.isUnsedParameter(searchParam))
                            return;

                        $scope.searchParams.push(
                            {
                                key: searchParam.key,
                                name: searchParam.name,
                                display: searchParam.display,
                                placeholder: searchParam.placeholder,
                                value: value || '',
                                editMode: enterEditModel,
                                options: searchParam.options,
                                optionsTemplate: searchParam.optionsTemplate
                            }
                        );

                        updateModel('add', searchParam.key, value);
                    };

                    $scope.removeSearchParam = function (index) {
                        if (index === undefined)
                            return;

                        var searchParam = $scope.searchParams[index];
                        $scope.searchParams.splice(index, 1);

                        updateModel('delete', searchParam.key);
                    };

                    $scope.removeAll = function() {
                        $scope.searchParams.length = 0;
                        $scope.searchQuery = '';

                        $scope.model = {};
                    };

                    $scope.editPrevious = function(currentIndex) {
                        if (currentIndex !== undefined)
                            $scope.leaveEditMode(currentIndex);

                        //TODO: check if index == 0 -> what then?
                        if (currentIndex > 0) {
                            $scope.enterEditMode(currentIndex - 1);
                        } else if ($scope.searchParams.length > 0) {
                            $scope.enterEditMode($scope.searchParams.length - 1);
                        }
                    };

                    $scope.editNext = function(currentIndex) {
                        if (currentIndex === undefined)
                            return;

                        $scope.leaveEditMode(currentIndex);

                        //TODO: check if index == array length - 1 -> what then?
                        if (currentIndex < $scope.searchParams.length - 1) {
                            $scope.enterEditMode(currentIndex + 1);
                        } else {
                            $scope.setSearchFocus = true;
                        }
                    };

                    $scope.keydown = function(e, searchParamIndex) {
                        var handledKeys = [8, 9, 13, 37, 39];
                        if (handledKeys.indexOf(e.which) === -1)
                            return;

                        var cursorPosition = getCurrentCaretPosition(e.target);

                        if (e.which == 8) { // backspace
                            if (cursorPosition === 0)
                                $scope.editPrevious(searchParamIndex);

                        } else if (e.which == 9) { // tab
                            if (e.shiftKey) {
                                e.preventDefault();
                                $scope.editPrevious(searchParamIndex);
                            } else {
                                e.preventDefault();
                                $scope.editNext(searchParamIndex);
                            }

                        } else if (e.which == 13) { // enter
                            $scope.editNext(searchParamIndex);

                        } else if (e.which == 37) { // left
                            if (cursorPosition === 0)
                                $scope.editPrevious(searchParamIndex);

                        } else if (e.which == 39) { // right
                            if (cursorPosition === e.target.value.length)
                                $scope.editNext(searchParamIndex);
                        }
                    };

                    function restoreModel() {
                        angular.forEach($scope.model, function (value, key) {
                            if (key === 'query') {
                                $scope.searchQuery = value;
                            } else {
                                var searchParam = $filter('filter')($scope.parameters, function (param) { return param.key === key; })[0];
                                if (searchParam !== undefined)
                                    $scope.addSearchParam(searchParam, value, false);
                            }
                        });
                    }

                    if ($scope.model === undefined) {
                        $scope.model = {};
                    } else {
                        restoreModel();
                    }

                    function updateModel(command, key, value) {
                        if (searchThrottleTimer)
                            $timeout.cancel(searchThrottleTimer);

                        // remove all previous entries to the same search key that was not handled yet
                        changeBuffer = $filter('filter')(changeBuffer, function (change) { return change.key !== key; });
                        // add new change to list
                        changeBuffer.push({
                            command: command,
                            key: key,
                            value: value
                        });

                        searchThrottleTimer = $timeout(function () {
                            angular.forEach(changeBuffer, function (change) {
                                if(change.command === 'delete')
                                    delete $scope.model[change.key];
                                else
                                    $scope.model[change.key] = change.value;
                            });

                            changeBuffer.length = 0;
                        }, 500);
                    }

                    function getCurrentCaretPosition(input) {
                        if (!input)
                            return 0;

                        // Firefox & co
                        if (typeof input.selectionStart === 'number') {
                            return input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd;

                        } else if (document.selection) { // IE
                            input.focus();
                            var selection = document.selection.createRange();
                            var selectionLength = document.selection.createRange().text.length;
                            selection.moveStart('character', -input.value.length);
                            return selection.text.length - selectionLength;
                        }

                        return 0;
                    }
                }
            ]
        };
    })
    .directive('csOiSelectWrapper', ['$compile', function ($compile) {
        return {
            restrict: 'E',
            link: function (scope, elem, attrs, controller) {
                // oi-select expects hard coded string for oi-options, will not work if bound
                var optionsTemplate = scope.searchParam.optionsTemplate;
                var compiled = $compile('<oi-select name="searchbox" class="search-parameter-input" nit-set-focus="searchParam.editMode" ng-keydown="keydown($event, $index)" ng-blur="leaveEditMode($index)" ng-model="searchParam.value" ng-if="searchParam.editMode && searchParam.options" ng-change="searchParamValueChanged(searchParam)" placeholder="{{searchParam.placeholder}}" oi-options="' + optionsTemplate + '"></oi-select>')(scope);
                elem.append(compiled);
            }
        };
    }])
    .directive('nitSetFocus', [
        '$timeout', '$parse',
        function($timeout, $parse) {
            return {
                restrict: 'A',
                link: function($scope, $element, $attrs) {
                    var model = $parse($attrs.nitSetFocus);
                    $scope.$watch(model, function(value) {
                        if (value === true) {
                            $timeout(function() {
                                $element[0].focus();
                            });
                        }
                    });
                    $element.bind('blur', function() {
                        $scope.$apply(model.assign($scope, false));
                    });
                }
            };
        }
    ])
    .directive('nitAutoSizeInput', [
        function() {
            return {
                restrict: 'A',
                scope: {
                    model: '=ngModel'
                },
                link: function($scope, $element, $attrs) {
                    var container = angular.element('<div style="position: fixed; top: -9999px; left: 0px;"></div>');
                    var shadow = angular.element('<span style="white-space:pre;"></span>');

                    var maxWidth = $element.css('maxWidth') === 'none' ? $element.parent().innerWidth() : $element.css('maxWidth');
                    $element.css('maxWidth', maxWidth);

                    angular.forEach([
                        'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
                        'letterSpacing', 'textTransform', 'wordSpacing', 'textIndent',
                        'boxSizing', 'borderLeftWidth', 'borderRightWidth', 'borderLeftStyle', 'borderRightStyle',
                        'paddingLeft', 'paddingRight', 'marginLeft', 'marginRight'
                    ], function(css) {
                        shadow.css(css, $element.css(css));
                    });

                    angular.element('body').append(container.append(shadow));

                    function resize() {
                        shadow.text($element.val() || $element.attr('placeholder'));
                        $element.css('width', shadow.outerWidth() + 10);
                    }

                    resize();

                    if ($scope.model) {
                        $scope.$watch('model', function() { resize(); });
                    } else {
                        $element.on('keypress keyup keydown focus input propertychange change', function() { resize(); });
                    }
                }
            };
        }
    ]);
})();

angular.module('angular-advanced-searchbox').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('angular-advanced-searchbox.html',
    "<div class=advancedSearchBox ng-class={active:focus} ng-init=\"focus = false\"><span ng-show=\"searchParams.length < 1 && searchQuery.length === 0\" class=\"search-icon glyphicon glyphicon-search\"></span> <a ng-href=\"\" ng-show=\"searchParams.length > 0 || searchQuery.length > 0\" ng-click=removeAll() role=button><span class=\"remove-all-icon glyphicon glyphicon-remove\"></span></a><div><div class=search-parameter ng-repeat=\"searchParam in searchParams\"><a ng-href=\"\" ng-click=removeSearchParam($index) role=button><span class=\"remove glyphicon glyphicon-remove\"></span></a><div class=key>{{searchParam.name}}:</div><div class=value><span ng-if=!searchParam.editMode ng-click=enterEditMode($index)>{{searchParam.display ? searchParam.value[searchParam.display] : searchParam.value}}</span><cs-oi-select-wrapper ng-if=\"searchParam.editMode && searchParam.options\" search-param=searchParam></cs-oi-select-wrapper><input name=value nit-auto-size-input nit-set-focus=searchParam.editMode ng-keydown=\"keydown($event, $index)\" ng-blur=leaveEditMode($index) ng-if=\"searchParam.editMode && !searchParam.options\" ng-change=searchParamValueChanged(searchParam) ng-model=searchParam.value placeholder=\"{{searchParam.placeholder}}\"></div></div><input name=searchbox class=search-parameter-input nit-auto-size-input nit-set-focus=setSearchFocus ng-keydown=keydown($event) placeholder={{placeholder}} ng-focus=\"focus = true\" ng-blur=\"focus = false\" typeahead-on-select=\"typeaheadOnSelect($item, $model, $label)\" typeahead=\"parameter as parameter.name for parameter in parameters | filter:isUnsedParameter | filter:{name:$viewValue} | limitTo:12\" ng-change=searchQueryChanged(searchQuery) ng-model=\"searchQuery\"></div><div class=search-parameter-suggestions ng-show=\"parameters && focus\"><span class=title>Parameter Suggestions:</span> <span class=search-parameter ng-repeat=\"param in parameters | filter:isUnsedParameter | limitTo:12\" ng-mousedown=addSearchParam(param)>{{param.name}}</span></div></div>"
  );

}]);
