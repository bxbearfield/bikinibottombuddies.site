<?php
  session_start();

  require_once('connectvars.php');  

  // If the user is logged in, delete the session vars to log them out
  if (isset($_SESSION['user_id'])) {
    // Delete the session vars by clearing the $_SESSION array
    $_SESSION = array();
    $_GET = array();
    $_POST = array();
    // Delete the session cookie by setting its expiration to an hour ago (3600)
    if (isset($_COOKIE[session_name()])) {
      setcookie(session_name(), '', time() - 3600);
    }

    // Destroy the session
    session_destroy();
  }

  // Delete the user user-id and email cookies by setting their expirations to an hour ago (3600)
  setcookie('user_id', '', time() - 3600);
  setcookie('email', '', time() - 3600);

  // Redirect to the home page
  // $home_url = 'https://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']).'/index.php';
  $home_url = 'https://' . $_SERVER['HTTP_HOST'];
  header('Location: ' . $home_url);
?>
