var params = {};
location.search.substr(1).split("&").forEach(function(item) 
            {params[item.split("=")[0]] = item.split("=")[1]});
var testing = params.test;

