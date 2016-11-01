<!DOCTYPE HTML PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"                                                
"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" land="ru" xml:lang="en" ng-app="profileApp">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <meta http-equiv="Content-Language" content="ru-ru"/>
        <meta name="description" content="" />
        <meta name="keywords" content="" />
        <title>ADXcluster.com - Profile</title>
        <link href="style.css" rel="stylesheet" type="text/css">
        <link href="colorpicker.min.css" rel="stylesheet" type="text/css">
        <link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet">
        <link rel="icon" href="/favicon.ico" type="image/x-icon">
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
        <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.5.7/angular.min.js"></script>
        <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.5.7/angular-sanitize.js"></script>
        <script src="userData.js"></script>
        <script src="bootstrap-colorpicker-module.min.js"></script>
        <script src="testing.js"></script>
        <script src="polyfill.js"></script>
        <script src="profile.js"></script>

    </head>
    <body ng-controller="bodyCtrl">

    <ng-include src="'menu.html'">
    </ng-include>

    <div id="profile">
        <!-- <h4>{{user.callsign}}</h4> -->
        <div id="profile_settings">
            <div id="profile_menu">
                <a ng-click="uploadAdifShow=true; changeEmailShow=false; changePwdShow=false">Upload ADIF log</a>
                <a ng-click="uploadAdifShow=false; changeEmailShow=true; changePwdShow=false">Change email</a>
                <a ng-click="uploadAdifShow=false; changeEmailShow=false; changePwdShow=true">Change password</a>
            </div>
            <form id="upload_adif" method="post" ng-show="uploadAdifShow" ng-submit="uploadAdif()">
                Upload ADIF log<br>
                <input type="file" name="adiflog" size="chars" id="adifFile" 
                    onchange="angular.element(this).scope().adifFileChanged(this)"/><br/>
                <input type="submit" id="submit_btn" name="change_psw" value="Upload"/><br/>
                <span ng-show="user.lastAdifLine">Last loaded QSO: {{user.lastAdifLine}}</span>
            </form>
            <form id="profile_call" method="post" ng-show="changeEmailShow">
                Email<br>
                <input type="text" name="email" ng-model="user.email"><br/>
                <input type="button" id="submit_btn" name="save_email" value="Save"
                    ng-click="changeEmailClick()">                
            </form>
            <form id="new_pass" method="post" ng-show="changePwdShow">
                Current password<br/>
                <input type="password" name="old_pass" ng-model="changePwd.oldPwd" 
                    ng-hide="changePwd.token"><br/>
                New password<br/>
                <input type="password" name="new_pass" ng-model="changePwd.newPwd"><br/>
                <input type="button" id="submit_btn" name="change_psw" value="Change password"
                    ng-click="changePwdClick()">                
            </form>
        </div> 
        <table id="loader" ng-show="loading"><tr><td>Loading...<br/><img src="/images/loader.gif" title="Loading"></td></tr></table>


    </div>
    <div id="counter">
        <!-- Yandex.Metrika informer --> <a href="https://metrika.yandex.ru/stat/?id=38305355&amp;from=informer" target="_blank" rel="nofollow"><img src="https://informer.yandex.ru/informer/38305355/3_0_EFEFEFFF_EFEFEFFF_0_pageviews" style="width:88px; height:31px; border:0;" alt="Яндекс.Метрика" title="Яндекс.Метрика: данные за сегодня (просмотры, визиты и уникальные посетители)" onclick="try{Ya.Metrika.informer({i:this,id:38305355,lang:'ru'});return false}catch(e){}" /></a> <!-- /Yandex.Metrika informer --> <!-- Yandex.Metrika counter --> <script type="text/javascript"> (function (d, w, c) { (w[c] = w[c] || []).push(function() { try { w.yaCounter38305355 = new Ya.Metrika({ id:38305355, clickmap:true, trackLinks:true, accurateTrackBounce:true }); } catch(e) { } }); var n = d.getElementsByTagName("script")[0], s = d.createElement("script"), f = function () { n.parentNode.insertBefore(s, n); }; s.type = "text/javascript"; s.async = true; s.src = "https://mc.yandex.ru/metrika/watch.js"; if (w.opera == "[object Opera]") { d.addEventListener("DOMContentLoaded", f, false); } else { f(); } })(document, window, "yandex_metrika_callbacks"); </script> <noscript><div><img src="https://mc.yandex.ru/watch/38305355" style="position:absolute; left:-9999px;" alt="" /></div></noscript> <!-- /Yandex.Metrika counter -->
    </div>

    </body>
</html>

