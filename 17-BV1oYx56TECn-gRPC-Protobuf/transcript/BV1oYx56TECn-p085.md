[00:00] Now let's begin working on reset password RPC. Let's first create the function signature.
[00:26] now the first thing that we need is to get the reset code from the request
[00:47] to search for the document for which we need to reset the password and then we need to apply validation if the new password and the confirmed password are same if they are not then in that case we need to return an error
[01:16] along with a message that passwords do not match.
[01:34] If the passwords match then we decode the token string back into the
[01:54] by its lies.
[02:09] And now using this byte slice we create the hashed token using SHA256 encryption.
[02:39] And now we encode this hashed token to create the token in database which we are going to search for.
[03:03] Now finally let's create the MongoDB client to run our query and search for a document based on this token in db.
[03:32] Now let's create a query to find a document based on this token in DB.
[04:01] And now we are not only going to filter the documents based on the token in DB value, but we also need to make sure that the password token expiry is before the current time or that we are not past the password token expires time. So let's create the filter.
[04:30] because this time we are going to use the greater than key dollar GT.
[04:51] And now for password token expires we have additional condition so it will require another bson.m
[05:17] and now here we are going to use $gt and the time should be greater than time.now
[05:33] But we are going to have to format this according to the format that was stored in the collection. Great, we have our filter ready. Let's pass that as an argument.
[06:01] And now we will need an instance of models.exec to store the resulting value.
[06:17] And now let's also handle the error.
[06:37] Now if there is no error that means we have found an entry and in that case we can now hash the new password and save it in our database. So for that we are going to call the utils.hashPassword function
[07:01] and pass it the request.NewPassword.
[07:20] Now once we have the hashed password we need to save that into our collection and at the same time we need to set the password reset token and password token expires values to nil.
[07:47] and for this we are going to use the update one method. So let me copy this and modify this to save time. Let's delete this and this is going to change to update one. And now apart from the filter because we are using the same filter we just need the update value. And here we also get the result so
[08:16] Here we can safely use the same filter and that is because we have reached this point because we have used the same filter earlier in our find one query. Alright, so if we were able to find a document using that filter, we can again find the same document using the same filter.
[08:41] So now let's prepare the update values and it's going to be a long struct. So let's create another variable to store the update values. And now because we are updating values, we will use the key dollar set and again call Beeson dot.
[09:10] Amstruct
[09:40] All right, so now that we have the
[10:09] argument ready let's pass it here and and now to get rid of this undefined Beeson error let's hit save great and now we also need to handle the error
[10:32] And if there is no error, then in that case we return a response.
[10:53] that's it now let's restart the server and now let's send a request to reset the password using the code that we received earlier
[11:20] Great. Here we are. So let's use this code. And I think we are past the time frame to update the password. So let's still see.
[11:49] And first let's check the password values. So I'm going to enter two different passwords here. Let's see what happens. Passwords do not match. Great. And now let's send the request. But with incorrect reset code. So let's send a blank reset code.
[12:17] Great. And I think this will also return the same response. Yes. All right. So let's invoke another request. Great. So now we have the new code. Let's use this. All right. So now let's paste the new reset code here and send.
[12:46] and here we go great so our password is reset and now let's log in with the new password
[13:05] let's first try with the old password it was secure password 1 and this is wrong great so let's now send 1 2 3 and
[13:32] here we go now we are able to log in great so our reset password RPC is also working perfectly great so now we need to refactor this and our database functionality starts from here and it ends here
[13:56] Great, so let's refactor this. And I'm going to rename this to Reset Password DB.
[14:14] And let's also move this over to the CRUD file. We don't need this now.
[14:41] And we should not need the complete request. I think we only need the new password. Yeah, that's it. So let's pass it the new password string. And that's it. Now what do we need to return from this?
[15:06] well just a confirmation so just an error would suffice and we are going to change the return values as well now
[15:25] and let's change this to new password hit save and that's it
[15:54] Now let's fix it here as well.
[16:07] And let's also handle the error.
[16:30] and hit ctrl s and the errors are gone that's it so our reset password is done let's now check its functionality after refactoring
[16:53] so let's send another request to reset the password by using forgot password first invoke and here we have the email as well great so let's copy this and paste this here
[17:18] and let's switch this back to secure password one we are able to log in with secure password one two three let me show that to you again the token was generated so the login is successful and now let's change this to secure password one great so it's changed and now if we try to log in with one two three we are not able to log in
[17:47] Great. And now we are. Alright, so our reset password RPC is also finished.
[17:57] you
