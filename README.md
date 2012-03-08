Quick Start Instructions
========================

After completing these instructions you will be able to run the test
server and interact with the Django based Specify webapp in your
browser on your local machine.


Install the Python MySQL drivers, and the package installer, pip.
-----------------------------------------------------------------
On Ubuntu:

    sudo apt-get install python-mysqldb python-pip

On Fedora:

   sudo yum install MySQL-python python-pip

Install Django 1.3.
-------------------
On Ubuntu:

    sudo pip install Django

If you are running Ubuntu 11.10 or later and prefer to use the Ubuntu
package, that will work too.

    sudo apt-get install python-django

On Fedora:

    sudo python-pip install Django


Install tastypie.
-----------------
On Ubuntu:

    sudo pip install django-tastypie

On Fedora:

    sudo python-pip install django-tastypie

The choice is yours.
--------------------
At this point you can switch over to the [Eclipse
instructions](README-ECLIPSE.md) if you want to use Eclipse for your
development. Or continue with these instructions and work from the
command line.

Get the djangospecify source code.
----------------------------------
Clone this repository:

    git clone git://github.com/benanhalt/djangospecify.git

You will now have a djangospecify directory containing the source
tree. From this point all commands will be with respect to that as the
working directory.

    cd djangospecify

Set database, username, and password.
-------------------------------------
Edit the `settings.py` file and configure the `DATABASES` section as follows,
choosing appropriate values for `NAME`, `USER`, and `PASSWORD`:

    DATABASES = {
        'default': {
            'ENGINE': 'djangospecify.hibernateboolsbackend.backends.mysql',
            'NAME': 'kuplant',   # name of a Specify 6.4 mysql database
            'USER': 'Master',    # mysql user with full privileges to that DB
            'PASSWORD': 'MasterPassword',
            'HOST': '',    # Set to empty string for localhost.
            'PORT': '',    # Set to empty string for default.
        }
    }
    
Sync the database:
------------------
The authentication system in django makes use of a couple extra tables. This
command will generate them:

    python manage.py syncdb

Run the test server:
--------------------

    python manage.py runserver


Visit the running app with your browser.
----------------------------------------
Paste this URL in your browser's location bar:
[http://127.0.0.1:8000](http://127.0.0.1:8000)
