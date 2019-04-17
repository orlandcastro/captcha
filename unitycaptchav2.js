var unitycaptcha = new unitycaptcha();
var db = openDatabase('captchadbv2', '1.0', 'Captcha Databse', 2 * 1024 * 1024);
var _captcha_image = {};
var captcha_current = {};
var test_code = null;
var countdown_set = 10;
var countdown = 0;
var countdown_timer = null;
var propeller_adlink = "https://go.onclasrv.com/afu.php?zoneid=1841798d";

function unitycaptcha() {
    init();

    function init() {
        $(document).ready(function() {
            document_ready();
        });
    }

    function document_ready() {
        event_restart_captcha();
        initialize_variables_and_settings();
        timer_countdown();
        prevent_double_submit();
    }

    function event_restart_captcha() {
        $(".restart-captcha").click(function() {
            $(".restart-captcha").hide();
            initialize_captcha();
        });
    }

    function submit_answers_to_server() {
        $(".submit-captcha").attr("disabled", "disabled");
        $(".form-captcha-submit").slideUp();
        $(".loading-submit").slideDown();
        db.transaction(function(tx) {
            tx.executeSql('SELECT * FROM tbl_captcha_image', [], function(tx, results) {
                var _answers = {};
                var _answers_param = {};
                for (var i = 0; i < results.rows.length; i++) {
                    var row = results.rows.item(i);
                    _answers[row.image_id] = row.answer;
                }
                _answers_param["_answers"] = _answers;
                _answers_param["test_code"] = test_code;
                console.log("Submitting answers to server");
                $.ajax({
                    url: "/submit_answers",
                    data: _answers_param,
                    type: "post",
                    success: function(data) {
                        console.log(data);
                        if (data.status == "fail") {
                            $(".alert").html(data.message);
                            $(".alert").addClass("alert-danger");
                            $(".alert").removeClass("alert-success");
                            $(".loading-submit").hide();
                            $(".alert").show();
                        } else {
                            $(".loading-submit").hide();
                            $(".alert").removeClass("alert-danger");
                            $(".alert").addClass("alert-success");
                            $(".alert").show();
                            $(".alert").html("Congratulations! You earned a total amount of <b>" + data.earnings_php + "</b> by<br>answering<b> " + data.correct + " out of " + data.total + "</b> questions correctly.");
                            $(".current-wallet").text(data.current_wallet);
                            $(".restart-captcha").show();
                            db.transaction(function(tx) {
                                console.log("Clearing previous data.");
                                tx.executeSql('DELETE FROM tbl_captcha_image');
                            });
                        }
                    },
                    error: function(data) {
                        submit_answers_to_server();
                    }
                });
            });
        });
    }

    function initialize_variables_and_settings() {
        if (!localStorage.countdown) {
            localStorage.setItem("countdown", 0);
        }
        $.ajaxSetup({
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            }
        });
        db.transaction(function(tx) {
            console.log("Inititalizing captcha");
            tx.executeSql('CREATE TABLE IF NOT EXISTS tbl_captcha_image (image_id, image_link, answer)');
            initialize_captcha();
        });
    }

    function initialize_captcha() {
        db.transaction(function(tx) {
            tx.executeSql('SELECT * FROM tbl_captcha_image', [], function(tx, results) {
                if (results.rows.length == 0) {
                    get_captcha_image_from_server();
                } else {
                    load_captcha_question();
                }
            });
        });
    }

    function load_captcha_question() {
        console.log("Load Captcha Question");
        $(".submit-captcha").removeAttr("disabled");
        $(".form-captcha-submit").slideDown();
        $(".loading-submit").slideUp();
        $("#captcha_answer").val("");
        $(".restart-captcha").hide();
        $(".alert").hide();
        db.transaction(function(tx) {
            tx.executeSql('SELECT * FROM tbl_captcha_image where answer IS NULL', [], function(tx, results) {
                _captcha_image = results;
                $(".captcha-remaining").text(_captcha_image.rows.length);
                if (_captcha_image.rows.length == 0) {
                    submit_answers_to_server();
                } else {
                    captcha_current = _captcha_image.rows.item(0);
                    $(".captcha-image").html("<img src='/captcha-image/" + captcha_current.image_link + "'>");
                    $("#captcha_answer").focus();
                }
            });
        });
    }

    function get_captcha_image_from_server() {
        $.ajax({
            url: "/captcha_image",
            dataType: "json",
            type: "post",
            success: function(data) {
                db.transaction(function(tx) {
                    $.each(data._captcha, function(key, val) {
                        tx.executeSql('INSERT INTO tbl_captcha_image (image_id, image_link) VALUES (?, ?)', [val.image_id, val.image_link]);
                    });
                    load_captcha_question();
                });
            },
            error: function(data) {
                setTimeout(function() {
                    get_captcha_image_from_server()
                }, 1000);
            }
        });
    }

    function prevent_double_submit() {
        $(".form-captcha-submit").submit(function() {
            if (localStorage.getItem("countdown") <= 0) {
                submit_ajax_form();
            }
            return false;
        });
    }

    function submit_ajax_form() {
        var captcha_answer = $("#captcha_answer").val();
        console.log("You answered '" + captcha_answer + "'");
        db.transaction(function(tx) {
            tx.executeSql('UPDATE tbl_captcha_image SET answer = ?  WHERE image_id = ?', [captcha_answer, captcha_current.image_id]);
            localStorage.setItem("countdown", countdown_set);
            load_captcha_question();
            start_countdown_timer();
        });
    }

    function start_countdown_timer() {
        clearTimeout(countdown_timer);
        $(".submit-captcha").attr("disabled", "disabled");
        $(".captcha-banned-second").text();
        timer_countdown();
    }

    function timer_countdown() {
        $(".captcha-banned").show();
        $(".captcha-banned-second").text(localStorage.getItem("countdown"));
        countdown_timer = setTimeout(function() {
            localStorage.setItem("countdown", localStorage.getItem("countdown") - 1);
            timer_countdown();
            if (localStorage.getItem("countdown") <= 0) {
                clearTimeout(countdown_timer);
                $(".captcha-banned").slideUp();
                $(".submit-captcha").removeAttr("disabled");
            } else {
                $(".submit-captcha").attr("disabled", "disabled");
            }
        }, 1000);
    }
}